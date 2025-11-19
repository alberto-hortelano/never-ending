/**
 * Logger wrapper for AI plugins that uses FileLogger
 */

import { FileLogger } from '../../../models/fileLogger';
import { IAILogger } from '../types';

/**
 * Wrapper class that implements IAILogger interface using FileLogger static methods
 */
export class AILogger implements IAILogger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  debug(message: string, data?: unknown): void {
    FileLogger.log(`[${this.context}][DEBUG] ${message}`, data);
  }

  info(message: string, data?: unknown): void {
    FileLogger.log(`[${this.context}] ${message}`, data);
  }

  warn(message: string, data?: unknown): void {
    // FileLogger doesn't have a static warn method, use log instead
    FileLogger.log(`[${this.context}][WARN] ${message}`, data);
  }

  error(message: string, error?: unknown): void {
    FileLogger.error(`[${this.context}] ${message}`, error);
  }
}