export interface ApiErrorPayload {
  error?: {
    code?: string
    message?: string
  }
}

export class ServerApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ServerApiError'
  }
}

export interface ServerApi {
  request<T>(path: string, init?: RequestInit): Promise<T>
}

export function createServerApi(fetcher: typeof fetch = fetch): ServerApi {
  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      let response: Response
      try {
        response = await fetcher(path, {
          ...init,
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...init.headers,
          },
        })
      } catch {
        throw new ServerApiError(0, 'SERVER_UNAVAILABLE', 'The server is unavailable. Your changes were not saved.')
      }

      if (response.status === 204) return undefined as T
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload & T
      if (!response.ok) {
        throw new ServerApiError(
          response.status,
          payload.error?.code ?? 'REQUEST_FAILED',
          payload.error?.message ?? 'The request could not be completed.',
        )
      }
      return payload
    },
  }
}

export const serverApi = createServerApi()
