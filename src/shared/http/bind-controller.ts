import { asyncHandler } from './async-handler'

export const bindController = <C extends object>(controller: C) => {
    return <K extends keyof C>(method: K) =>
        asyncHandler((controller[method] as Function).bind(controller))
}
