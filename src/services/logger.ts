export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogCategory = "ai_request" | "tool_call" | "database" | "provider" | "error" | "system";

export interface LogEntry {
  userId?: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private formatConsole(entry: LogEntry): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]: ${entry.message}`;
  }

  log(entry: LogEntry): void {
    const formatted = this.formatConsole(entry);
    const meta = entry.metadata ? JSON.stringify(entry.metadata) : "";

    switch (entry.level) {
      case "error":
        console.error(formatted, meta);
        break;
      case "warn":
        console.warn(formatted, meta);
        break;
      case "debug":
        console.debug(formatted, meta);
        break;
      default:
        console.log(formatted, meta);
        break;
    }
  }

  info(category: LogCategory, message: string, metadata?: Record<string, unknown>, userId?: string) {
    this.log({
      level: "info",
      category,
      message,
      ...(metadata ? { metadata } : {}),
      ...(userId ? { userId } : {}),
    });
  }

  warn(category: LogCategory, message: string, metadata?: Record<string, unknown>, userId?: string) {
    this.log({
      level: "warn",
      category,
      message,
      ...(metadata ? { metadata } : {}),
      ...(userId ? { userId } : {}),
    });
  }

  error(category: LogCategory, message: string, metadata?: Record<string, unknown>, userId?: string) {
    this.log({
      level: "error",
      category,
      message,
      ...(metadata ? { metadata } : {}),
      ...(userId ? { userId } : {}),
    });
  }
}

export const logger = new Logger();
