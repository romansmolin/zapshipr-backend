export interface ApiRequestOptions {
    headers?: Record<string, string>
    params?: Record<string, string | number | boolean>
    responseType?: 'json' | 'arraybuffer' | 'document' | 'text' | 'stream'
    timeoutMs?: number
    raw?: Record<string, unknown>
}

export interface IHttpClient {
    post<TResponse = unknown, TRequestBody = unknown>(
        url: string,
        body?: TRequestBody,
        options?: ApiRequestOptions
    ): Promise<TResponse>
    put<TResponse = unknown, TRequestBody = unknown>(
        url: string,
        body?: TRequestBody,
        options?: ApiRequestOptions
    ): Promise<TResponse>
    delete<TResponse = unknown, TRequestBody = unknown>(
        url: string,
        body?: TRequestBody,
        options?: ApiRequestOptions
    ): Promise<TResponse>
    get<TResponse = unknown>(url: string, options?: ApiRequestOptions): Promise<TResponse>
}
