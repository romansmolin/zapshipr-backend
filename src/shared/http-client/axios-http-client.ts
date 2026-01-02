import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { ApiRequestOptions, IHttpClient } from './http-client.interface'

const DEFAULT_TIMEOUT = 30_000

export class AxiosHttpClient implements IHttpClient {
    private readonly client: AxiosInstance

    constructor(baseURL?: string, defaultHeaders?: Record<string, string>) {
        this.client = axios.create({
            baseURL,
            timeout: DEFAULT_TIMEOUT,
            headers: defaultHeaders,
        })
    }

    private buildConfig(options?: ApiRequestOptions): AxiosRequestConfig {
        if (!options) return {}

        const config: AxiosRequestConfig = {}

        if (options.headers) {
            config.headers = { ...options.headers }
        }

        if (options.params) {
            config.params = { ...options.params }
        }

        if (options.responseType) {
            config.responseType = options.responseType
        }

        if (typeof options.timeoutMs === 'number') {
            config.timeout = options.timeoutMs
        }

        if (options.raw && typeof options.raw === 'object' && options.raw !== null) {
            Object.assign(config, options.raw as AxiosRequestConfig)
        }

        return config
    }

    async post<TResponse = unknown, TRequestBody = unknown>(
        url: string,
        body?: TRequestBody,
        options?: ApiRequestOptions
    ): Promise<TResponse> {
        const response = await this.client.post(url, body, this.buildConfig(options))
        const { data } = response
        return data
    }
    async put<TResponse = unknown, TRequestBody = unknown>(
        url: string,
        body?: TRequestBody,
        options?: ApiRequestOptions
    ): Promise<TResponse> {
        const response = await this.client.put(url, body, this.buildConfig(options))
        const { data } = response
        return data
    }
    async delete<TResponse = unknown, TRequestBody = unknown>(
        url: string,
        body?: TRequestBody,
        options?: ApiRequestOptions
    ): Promise<TResponse> {
        const config = this.buildConfig(options)
        if (body !== undefined) {
            config.data = body
        }
        const response = await this.client.delete(url, config)
        const { data } = response
        return data
    }
    async get<TResponse = unknown>(url: string, options?: ApiRequestOptions): Promise<TResponse> {
        const response = await this.client.get(url, this.buildConfig(options))
        const { data } = response
        return data
    }
}
