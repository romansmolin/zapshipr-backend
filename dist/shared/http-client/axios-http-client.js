"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AxiosHttpClient = void 0;
const axios_1 = __importDefault(require("axios"));
const DEFAULT_TIMEOUT = 30000;
class AxiosHttpClient {
    constructor(baseURL, defaultHeaders) {
        this.client = axios_1.default.create({
            baseURL,
            timeout: DEFAULT_TIMEOUT,
            headers: defaultHeaders,
        });
    }
    buildConfig(options) {
        if (!options)
            return {};
        const config = {};
        if (options.headers) {
            config.headers = { ...options.headers };
        }
        if (options.params) {
            config.params = { ...options.params };
        }
        if (options.responseType) {
            config.responseType = options.responseType;
        }
        if (typeof options.timeoutMs === 'number') {
            config.timeout = options.timeoutMs;
        }
        if (options.raw && typeof options.raw === 'object' && options.raw !== null) {
            Object.assign(config, options.raw);
        }
        return config;
    }
    async post(url, body, options) {
        const response = await this.client.post(url, body, this.buildConfig(options));
        const { data } = response;
        return data;
    }
    async put(url, body, options) {
        const response = await this.client.put(url, body, this.buildConfig(options));
        const { data } = response;
        return data;
    }
    async delete(url, body, options) {
        const config = this.buildConfig(options);
        if (body !== undefined) {
            config.data = body;
        }
        const response = await this.client.delete(url, config);
        const { data } = response;
        return data;
    }
    async get(url, options) {
        const response = await this.client.get(url, this.buildConfig(options));
        const { data } = response;
        return data;
    }
}
exports.AxiosHttpClient = AxiosHttpClient;
