/**
 * Logging levels
 */
export type LogLevel = "silent" | "normal" | "verbose" | "debug";

/**
 * Logger class for CLI output
 */
export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = "normal") {
    this.level = level;
  }

  /**
   * Set logging level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Log info message (always shown unless silent)
   */
  info(message: string): void {
    if (this.level !== "silent") {
      console.error(message);
    }
  }

  /**
   * Log error message (always shown)
   */
  error(message: string, error?: unknown): void {
    console.error(message);
    if (error && this.level === "debug") {
      console.error(error);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    if (this.level !== "silent") {
      console.warn(`⚠️  ${message}`);
    }
  }

  /**
   * Log debug message (only in verbose/debug mode)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.level === "verbose" || this.level === "debug") {
      console.error(`🔍 ${message}`, ...args);
    }
  }

  /**
   * Log verbose message (only in verbose/debug mode)
   */
  verbose(message: string): void {
    if (this.level === "verbose" || this.level === "debug") {
      console.error(`ℹ️  ${message}`);
    }
  }

  /**
   * Log success message
   */
  success(message: string): void {
    if (this.level !== "silent") {
      console.error(`✅ ${message}`);
    }
  }
}

