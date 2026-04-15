"use strict";

// 内置默认 AI 凭证：为了让终端用户开箱即用，默认 API Key 以轻度混淆方式内置。
// 用户可通过 Settings -> AI 服务 设置自己的 Key 覆盖这里的默认值。
// 这里使用 XOR+base64 只是为了避免静态字符串被直接爬取，并非安全加密；
// 如果担心 Key 被滥用，请让每位用户填写自己的 Key。

const PAD = "temu-automation-brand-defaults-2026";

function decode(encoded) {
  if (!encoded) return "";
  try {
    const buf = Buffer.from(encoded, "base64");
    const out = [];
    for (let i = 0; i < buf.length; i++) {
      out.push(buf[i] ^ PAD.charCodeAt(i % PAD.length));
    }
    return Buffer.from(out).toString("utf8");
  } catch (_err) {
    return "";
  }
}

const ENCODED = Object.freeze({
  analyzeApiKey: "Bw5AOmMKLD1ZFBQyKy1bRSAYEAgUZSIhUDslKgASawJhUQdEBwEzVSggLVcZKiAeHSJp",
  generateApiKey: "Bw5AFB1QTUBZXVMVWlpZGQZDVw9UFQABUQUTW0QSSVcBUwE=",
});

const PLAINTEXT_DEFAULTS = Object.freeze({
  analyzeBaseUrl: "https://api.vectorengine.ai",
  analyzeModel: "gemini-3.1-flash-lite-preview",
  generateBaseUrl: "https://grsaiapi.com",
  generateModel: "nano-banana-2",
});

function getDefaultCredentials() {
  return {
    analyzeApiKey: decode(ENCODED.analyzeApiKey),
    analyzeBaseUrl: PLAINTEXT_DEFAULTS.analyzeBaseUrl,
    analyzeModel: PLAINTEXT_DEFAULTS.analyzeModel,
    generateApiKey: decode(ENCODED.generateApiKey),
    generateBaseUrl: PLAINTEXT_DEFAULTS.generateBaseUrl,
    generateModel: PLAINTEXT_DEFAULTS.generateModel,
  };
}

module.exports = { getDefaultCredentials };
