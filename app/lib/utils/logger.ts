/**
 * Logging utility with timestamps and file output for boss-agent
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export class Logger {
  private static instance: Logger;
  private prefix: string;
  private logDir: string;

  private constructor(prefix: string = '') {
    this.prefix = prefix;
    this.logDir = './data/logs';
  }

  static getInstance(prefix: string = ''): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(prefix);
    }
    return Logger.instance;
  }

  private getTimestamp(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    return `[${hours}:${minutes}:${seconds}.${milliseconds}]`;
  }

  private getDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async writeToFile(level: string, ...args: any[]): Promise<void> {
    try {
      // Ensure logs directory exists
      await mkdir(this.logDir, { recursive: true });
      
      // Create daily log file
      const logFileName = `console-${this.getDateString()}.log`;
      const logFilePath = join(this.logDir, logFileName);
      
      // Format log entry
      const timestamp = this.getTimestamp();
      const logEntry = `${timestamp} ${this.prefix ? this.prefix + ' ' : ''}${level}: ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}\n`;
      
      // Append to log file
      await writeFile(logFilePath, logEntry, { flag: 'a' });
    } catch (error) {
      // Silently fail to avoid infinite loops, but log to console
      console.error('Failed to write to log file:', error);
    }
  }

  log(...args: any[]): void {
    this.writeToFile('', ...args).catch(() => {});
  }

  error(...args: any[]): void {
    this.writeToFile('ERROR', ...args).catch(() => {});
  }

  warn(...args: any[]): void {
    this.writeToFile('WARN', ...args).catch(() => {});
  }

  info(...args: any[]): void {
    this.writeToFile('INFO', ...args).catch(() => {});
  }

  debug(...args: any[]): void {
    if (process.env.DEBUG === 'true') {
      this.writeToFile('DEBUG', ...args).catch(() => {});
    }
  }
}

// Convenience functions for direct usage
export const log = (...args: any[]) => Logger.getInstance().log(...args);
export const logError = (...args: any[]) => Logger.getInstance().error(...args);
export const logWarn = (...args: any[]) => Logger.getInstance().warn(...args);
export const logInfo = (...args: any[]) => Logger.getInstance().info(...args);
export const logDebug = (...args: any[]) => Logger.getInstance().debug(...args);
