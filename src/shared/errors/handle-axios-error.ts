import type { AxiosError } from 'axios'

import type { ILogger } from '@/shared/logger/logger.interface'

export const handleAxiosErrors = (error: AxiosError, logger: ILogger): void => {
    logger.error('Axios request failed', {
        operation: 'handleAxiosErrors',
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        response: error.response?.data,
        message: error.message,
    })
}
