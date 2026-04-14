/**
 * worker.mjs 用的 Gemini 原生 :generateContent 适配器（ESM/JS 版）
 *
 * 暴露 OpenAI 风格的 chat.completions.create({model, messages, temperature, max_tokens})，
 * 内部转换为 POST {baseURL}/v1beta/models/{model}:generateContent。
 */

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function dataUrlToInlineData(dataUrl) {
  const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

function partsFromOpenAIContent(content) {
  if (typeof content === "string") {
    return [{ text: content }];
  }
  if (!Array.isArray(content)) return [];
  const parts = [];
  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "text" && typeof item.text === "string") {
      parts.push({ text: item.text });
    } else if (item.type === "image_url" && item.image_url?.url) {
      const inline = dataUrlToInlineData(item.image_url.url);
      if (inline) parts.push({ inlineData: inline });
    }
  }
  return parts;
}

function buildContents(messages) {
  const systemTexts = [];
  const contents = [];
  for (const m of messages || []) {
    if (!m || typeof m !== "object") continue;
    if (m.role === "system") {
      const parts = partsFromOpenAIContent(m.content);
      for (const p of parts) {
        if (p.text) systemTexts.push(p.text);
      }
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: partsFromOpenAIContent(m.content),
    });
  }
  if (systemTexts.length && contents.length && contents[0].role === "user") {
    contents[0].parts.unshift({ text: systemTexts.join("\n\n") });
  }
  return contents;
}

function extractContentString(candidate) {
  const parts = candidate?.content?.parts || [];
  const out = [];
  for (const p of parts) {
    if (p && typeof p.text === "string") {
      out.push(p.text);
    } else if (p?.inlineData?.data) {
      const mime = p.inlineData.mimeType || "image/png";
      out.push(`data:${mime};base64,${p.inlineData.data}`);
    }
  }
  return out.join("\n");
}

async function fetchWithRetry(url, init, maxRetries, timeoutMs) {
  let lastErr = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (resp.status === 200 || !RETRYABLE_STATUS.has(resp.status)) {
        return resp;
      }
      lastErr = new Error(`HTTP ${resp.status}`);
      if (attempt < maxRetries - 1) {
        const errText = await resp.clone().text().catch(() => "");
        console.error(`[gemini] retryable ${resp.status} (attempt ${attempt + 1}/${maxRetries}): ${errText.slice(0, 200)}`);
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      return resp;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Gemini fetch failed");
}

export class GeminiClient {
  constructor(opts = {}) {
    if (!opts.apiKey) {
      throw new Error("Gemini client requires apiKey");
    }
    this.apiKey = opts.apiKey;
    this.baseURL = String(opts.baseURL || "https://api.vectorengine.ai").replace(/\/+$/, "");
    this.timeout = Number.isFinite(opts.timeout) ? opts.timeout : 300000;
    this.maxRetries = Number.isFinite(opts.maxRetries) ? opts.maxRetries : 3;

    this.chat = {
      completions: {
        create: (params) => this._createCompletion(params),
      },
    };
  }

  async _createCompletion(params) {
    const model = params?.model;
    if (!model) throw new Error("Gemini chat completion requires model");

    const generationConfig = {};
    if (Number.isFinite(params.max_tokens)) {
      generationConfig.maxOutputTokens = params.max_tokens;
    }
    if (Number.isFinite(params.temperature)) {
      generationConfig.temperature = params.temperature;
    }

    const body = {
      contents: buildContents(params.messages || []),
      ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    };

    const url = `${this.baseURL}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      },
      this.maxRetries,
      this.timeout,
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      const error = new Error(`Gemini API ${response.status}: ${errText.slice(0, 500)}`);
      error.status = response.status;
      throw error;
    }

    const json = await response.json();
    const candidate = json?.candidates?.[0];
    if (!candidate) {
      throw new Error(`Gemini API returned no candidates: ${JSON.stringify(json).slice(0, 500)}`);
    }

    return {
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: extractContentString(candidate) },
          finish_reason: candidate.finishReason || "stop",
        },
      ],
    };
  }
}

export function createGeminiClient(opts = {}) {
  return new GeminiClient(opts);
}
