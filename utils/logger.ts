/**
 * Production-safe logging utility
 * Automatically gates console logs based on environment
 */

const isDevelopment = __DEV__;

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LoggerOptions {
  enabled?: boolean;
  prefix?: string;
}

class Logger {
  private enabled: boolean;
  private prefix: string;

  constructor(options: LoggerOptions = {}) {
    this.enabled = options.enabled ?? isDevelopment;
    this.prefix = options.prefix ?? '[App]';
  }

  private formatMessage(level: LogLevel, ...args: any[]): any[] {
    const timestamp = new Date().toISOString();
    return [`${this.prefix} [${level.toUpperCase()}] ${timestamp}:`, ...args];
  }

  log(...args: any[]): void {
    if (this.enabled) {
      console.log(...this.formatMessage('log', ...args));
    }
  }

  info(...args: any[]): void {
    if (this.enabled) {
      console.info(...this.formatMessage('info', ...args));
    }
  }

  warn(...args: any[]): void {
    if (this.enabled) {
      console.warn(...this.formatMessage('warn', ...args));
    }
  }

  error(...args: any[]): void {
    // Always log errors, even in production
    console.error(...this.formatMessage('error', ...args));
  }

  debug(...args: any[]): void {
    if (this.enabled) {
      console.debug(...this.formatMessage('debug', ...args));
    }
  }

  /**
   * Create a scoped logger with a specific prefix
   */
  scope(scopeName: string): Logger {
    return new Logger({
      enabled: this.enabled,
      prefix: `${this.prefix}:${scopeName}`,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for custom instances
export { Logger };

// Convenience exports for common use cases
export const createLogger = (prefix: string, enabled?: boolean) => 
  new Logger({ prefix, enabled });
