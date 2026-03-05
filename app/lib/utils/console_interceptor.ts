/**
 * Console interceptor to capture all console output and redirect to log files
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export class ConsoleInterceptor {
  private static instance: ConsoleInterceptor;
  private logDir: string;
  private originalConsole: typeof console;
  private dateString: string;

  private constructor() {
    this.logDir = './data/logs';
    this.originalConsole = { ...console };
    this.dateString = this.getDateString();
  }

  static getInstance(): ConsoleInterceptor {
    if (!ConsoleInterceptor.instance) {
      ConsoleInterceptor.instance = new ConsoleInterceptor();
    }
    return ConsoleInterceptor.instance;
  }

  private getDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getTimestamp(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    return `[${hours}:${minutes}:${seconds}.${milliseconds}]`;
  }

  private async writeToFile(method: string, ...args: any[]): Promise<void> {
    try {
      // Check if date has rolled over to a new day
      const newDateString = this.getDateString();
      if (newDateString !== this.dateString) {
        this.dateString = newDateString;
      }

      // Ensure logs directory exists
      await mkdir(this.logDir, { recursive: true });
      
      // Create daily log file
      const logFileName = `console-${this.dateString}.log`;
      const logFilePath = join(this.logDir, logFileName);
      
      // Format log entry
      const timestamp = this.getTimestamp();
      const logEntry = `${timestamp} ${method}: ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')}\n`;
      
      // Append to log file
      await writeFile(logFilePath, logEntry, { flag: 'a' });
    } catch (error) {
      // Use original console to avoid infinite loops
      this.originalConsole.error('Failed to write to log file:', error);
    }
  }

  public intercept(): void {
    // Override console methods
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.writeToFile('LOG', ...args).catch(() => {});
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.writeToFile('ERROR', ...args).catch(() => {});
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.writeToFile('WARN', ...args).catch(() => {});
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.writeToFile('INFO', ...args).catch(() => {});
    };

    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      this.writeToFile('DEBUG', ...args).catch(() => {});
    };
  }

  public restore(): void {
    // Restore original console methods
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;
  }
}
