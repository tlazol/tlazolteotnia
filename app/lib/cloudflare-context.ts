import { createContext } from 'react-router'

export const dbContext = createContext<D1Database>()
export const reactionSecretContext = createContext<string>()
export const reactionCountsCacheContext = createContext<Cache | null>(null)
export const waitUntilContext = createContext<ExecutionContext['waitUntil'] | null>(null)
