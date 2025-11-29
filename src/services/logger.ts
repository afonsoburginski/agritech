/**
 * Serviço de logging estruturado
 * Substitui console.log por sistema profissional de logs
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  stack?: string;
}

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (__DEV__) {
      // Em desenvolvimento, logar todos os níveis
      return true;
    }
    // Em produção, logar apenas warn e error
    return level === 'warn' || level === 'error';
  }

  private sanitizeData(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'token', 'auth', 'secret', 'key', 'senha', 'credential'];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitizeData(value);
      }
    }

    return sanitized;
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context) {
      entry.context = this.sanitizeData(context) as LogContext;
    }

    if (error) {
      entry.stack = error.stack;
      if (!entry.context) {
        entry.context = {};
      }
      entry.context.error = {
        name: error.name,
        message: error.message,
      };
    }

    return entry;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.formatLog(level, message, context, error);
    const logString = JSON.stringify(entry, null, __DEV__ ? 2 : 0);

    // Usar console apropriado baseado no nível
    switch (level) {
      case 'debug':
        console.log(logString);
        break;
      case 'info':
        console.info(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
        console.error(logString);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error);
  }
}

export const logger = new Logger();

