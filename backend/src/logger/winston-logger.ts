import { LoggerService, Injectable } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';

/**
 * JSON for log output that never throws: a log call must not fail because a
 * field is circular or holds a BigInt.
 */
function safeJson(value: unknown, indent?: number): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return '[unserializable]';
  }
}

/**
 * Renders a log field for the printf formats. Strings pass through unchanged;
 * objects are JSON rather than "[object Object]".
 */
function asText(value: unknown, indent?: number): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    return safeJson(value, indent);
  }
  return String(value);
}

/** Nest passes a context string and/or a stack or metadata object. */
type LogMeta = Record<string, unknown>;

@Injectable()
export class WinstonLogger implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    const logsDir = path.join(process.cwd(), 'logs');

    // Daily rotate file format (JSON style for structured analysis or structured text)
    const fileFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.printf(
        ({ timestamp, level, message, context, stack, ...meta }) => {
          const ctx = context ? `[${asText(context)}] ` : '';
          const logMessage = asText(message);
          const metaStr = Object.keys(meta).length ? ` ${safeJson(meta)}` : '';
          const stackStr = stack ? `\n${asText(stack)}` : '';
          return `[${asText(timestamp)}] [${level.toUpperCase()}] ${ctx}${logMessage}${metaStr}${stackStr}`;
        },
      ),
    );

    // Development Console format (Colorized and pretty)
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.colorize({ all: true }),
      winston.format.printf(
        ({ timestamp, level, message, context, stack, ...meta }) => {
          const ctx = context ? `\x1b[36m[${asText(context)}]\x1b[39m ` : ''; // Cyan color for context
          const logMessage = asText(message, 2);
          const metaStr = Object.keys(meta).length ? ` ${safeJson(meta)}` : '';
          const stackStr = stack ? `\n${asText(stack)}` : '';
          return `[${asText(timestamp)}] ${level} ${ctx}${logMessage}${metaStr}${stackStr}`;
        },
      ),
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

  private parseOptionalParams(optionalParams: unknown[]) {
    let context = '';
    let stack: string | undefined = undefined;
    let meta: LogMeta = {};

    if (optionalParams.length > 0) {
      const lastParam = optionalParams[optionalParams.length - 1];
      if (typeof lastParam === 'string') {
        context = lastParam;
        if (optionalParams.length > 1) {
          const firstParam = optionalParams[0];
          if (typeof firstParam === 'string') {
            stack = firstParam;
          } else {
            meta = firstParam as LogMeta;
          }
        }
      } else {
        meta = optionalParams[0] as LogMeta;
      }
    }
    return { context, stack, ...meta };
  }

  log(message: any, ...optionalParams: unknown[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    // winston types the message as string when meta follows, but accepts
    // any value at runtime; the printf formats above stringify objects.
    this.logger.info(message as string, { context, ...meta });
  }

  error(message: any, ...optionalParams: unknown[]) {
    let context = '';
    let stack: string | undefined = undefined;
    let meta: LogMeta = {};

    if (optionalParams.length > 0) {
      const [first, second] = optionalParams;
      if (typeof first === 'string') {
        stack = first;
      }
      if (optionalParams.length > 1 && typeof second === 'string') {
        context = second;
      } else if (optionalParams.length > 1) {
        meta = second as LogMeta;
      }
      if (
        optionalParams.length === 1 &&
        typeof optionalParams[0] !== 'string'
      ) {
        meta = first as LogMeta;
      }
    }

    // Handle standard JS/TS Error object passed as message
    if (message instanceof Error) {
      if (!stack) stack = message.stack;
      message = message.message;
    }

    this.logger.error(message as string, { context, stack, ...meta });
  }

  warn(message: any, ...optionalParams: unknown[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    this.logger.warn(message as string, { context, ...meta });
  }

  debug(message: any, ...optionalParams: unknown[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    this.logger.debug(message as string, { context, ...meta });
  }

  verbose(message: any, ...optionalParams: unknown[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    this.logger.verbose(message as string, { context, ...meta });
  }

  fatal(message: any, ...optionalParams: unknown[]) {
    const { context, ...meta } = this.parseOptionalParams(optionalParams);
    this.logger.error(message as string, { context, fatal: true, ...meta });
  }
}
