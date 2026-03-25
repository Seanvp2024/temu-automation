type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

class Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      data,
    };

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.module}]`;

    switch (level) {
      case "error":
        console.error(`${prefix} ${message}`, data ?? "");
        break;
      case "warn":
        console.warn(`${prefix} ${message}`, data ?? "");
        break;
      case "debug":
        console.debug(`${prefix} ${message}`, data ?? "");
        break;
      default:
        console.log(`${prefix} ${message}`, data ?? "");
    }

    // 同时输出 JSON 格式到 stdout，供 Tauri sidecar 解析
    if (level !== "debug") {
      const jsonOutput = JSON.stringify({
        type: "log",
        ...entry,
      });
      process.stdout.write(jsonOutput + "\n");
    }
  }

  info(message: string, data?: unknown) { this.log("info", message, data); }
  warn(message: string, data?: unknown) { this.log("warn", message, data); }
  error(message: string, data?: unknown) { this.log("error", message, data); }
  debug(message: string, data?: unknown) { this.log("debug", message, data); }
}

export function createLogger(module: string): Logger {
  return new Logger(module);
}
