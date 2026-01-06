"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
class ConsoleLogger {
    formatMessage(level, message, meta) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] ${level}: ${message}`;
    }
    info(message, meta) {
        console.info(this.formatMessage('INFO', message), meta || '');
    }
    warn(message, meta) {
        console.warn(this.formatMessage('WARN', message), meta || '');
    }
    error(message, meta) {
        console.error(this.formatMessage('ERROR', message), meta || '');
    }
    debug(message, meta) {
        console.debug(this.formatMessage('DEBUG', message), meta || '');
    }
}
exports.ConsoleLogger = ConsoleLogger;
