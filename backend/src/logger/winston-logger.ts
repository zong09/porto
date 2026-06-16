import { LoggerService, Injectable } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';

@Injectable()
export class WinstonLogger implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    const logsDir = path.join(process.cwd(), 'logs');

    // Daily rotate file format (JSON style for structured analysis or structured text)
    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
        const ctx = context ? `[${context}] ` : '';
        const logMessage = typeof message === 'object' ? JSON.stringify(message) : message;
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        const stackStr = stack ? `\n${stack}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${ctx}${logMessage}${metaStr}${stackStr}`;
      }),
    );

    // Development Console format (Colorized and pretty)
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.colorize({ all: true }),
      winston.format.printf(({ timestamp, level, message, context, stack, ...meta }) => {
        const ctx = context ? `\x1b[36m[${context}]\x1b[39m ` : ''; // Cyan color for context
        const logMessage = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        const stackStr = stack ? `\n${stack}` : '';
        return `[${timestamp}] ${level} ${ctx}${logMessage}${metaStr}${stackStr}`;
      }),
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      transports: [
        // Console logging
        new winston.transports.Console({
          format: consoleFormat,
        }),
        // Daily rotate file logging (Combined application logs)
        new DailyRotateFile({
          dirname: logsDir,
          filename: 'application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
          format: fileFormat,
        }),
        // Daily rotate file logging (Errors only)
        new DailyRotateFile({
          dirname: logsDir,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
          format: fileFormat,
        }),
      ],
    });
  }

  private parseOptionalParams(optionalParams: any[]) {
    let context = '';
    let stack: string | undefined = undefined;
    let meta = {};

    if (optionalParams.length > 0) {
      const lastParam = optionalParams[optionalParams.length - 1];
      if (typeof lastParam === 'string') {
        context = lastParam;
        if (optionalParams.length > 1) {
          const firstParam = optionalParams[0];
          if (typeof firstParam === 'string') {
            stack = firstParam;
          } else {
            meta = firstParam;
          }
        }
      } else {
        meta = optionalParams[0];
      }
    }
    return { context, stack, ...meta };
  }

  log(message: any, ...optionalParams: any[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    this.logger.info(message, { context, ...meta });
  }

  error(message: any, ...optionalParams: any[]) {
    let context = '';
    let stack: string | undefined = undefined;
    let meta = {};

    if (optionalParams.length > 0) {
      if (typeof optionalParams[0] === 'string') {
        stack = optionalParams[0];
      }
      if (optionalParams.length > 1 && typeof optionalParams[1] === 'string') {
        context = optionalParams[1];
      } else if (optionalParams.length > 1) {
        meta = optionalParams[1];
      }
      if (optionalParams.length === 1 && typeof optionalParams[0] !== 'string') {
        meta = optionalParams[0];
      }
    }

    // Handle standard JS/TS Error object passed as message
    if (message instanceof Error) {
      if (!stack) stack = message.stack;
      message = message.message;
    }

    this.logger.error(message, { context, stack, ...meta });
  }

  warn(message: any, ...optionalParams: any[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    this.logger.warn(message, { context, ...meta });
  }

  debug(message: any, ...optionalParams: any[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    this.logger.debug(message, { context, ...meta });
  }

  verbose(message: any, ...optionalParams: any[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    this.logger.verbose(message, { context, ...meta });
  }

  fatal(message: any, ...optionalParams: any[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    this.logger.error(message, { context, fatal: true, ...meta });
  }
}
