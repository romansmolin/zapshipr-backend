export interface LogMetadata {
    timestamp?: string
    operation?: string
    userId?: string
    entity?: string
    duration?: number
    error?:
        | {
              name?: string
              code?: string | number
              stack?: string
              message?: string
          }
        | string
        | Error
    [key: string]: any // for additional custom metadata
}

export interface ILogger {
    info(message: string, meta?: LogMetadata): void
    warn(message: string, meta?: LogMetadata): void
    error(message: string, meta?: LogMetadata): void
    debug(message: string, meta?: LogMetadata): void
}
