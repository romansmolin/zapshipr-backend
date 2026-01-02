import { ILogger, LogMetadata } from './logger.interface'

export class ConsoleLogger implements ILogger {
    private formatMessage(level: string, message: string, meta?: LogMetadata): string {
        const timestamp = new Date().toISOString()

        return `[${timestamp}] ${level}: ${message}`
    }

    info(message: string, meta?: LogMetadata): void {
        console.info(this.formatMessage('INFO', message), meta || '')
    }

    warn(message: string, meta?: LogMetadata): void {
        console.warn(this.formatMessage('WARN', message), meta || '')
    }

    error(message: string, meta?: LogMetadata): void {
        console.error(this.formatMessage('ERROR', message), meta || '')
    }

    debug(message: string, meta?: LogMetadata): void {
        console.debug(this.formatMessage('DEBUG', message), meta || '')
    }
}
