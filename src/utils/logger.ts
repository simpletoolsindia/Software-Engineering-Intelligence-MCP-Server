// Logger utility - lightweight stderr logger
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  args?: unknown[];
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private format(level: LogLevel, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${argsStr}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      process.stderr.write(this.format('debug', message, args) + '\n');
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      process.stderr.write(this.format('info', message, args) + '\n');
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      process.stderr.write(this.format('warn', message, args) + '\n');
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      process.stderr.write(this.format('error', message, args) + '\n');
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Singleton logger
export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info'
);
