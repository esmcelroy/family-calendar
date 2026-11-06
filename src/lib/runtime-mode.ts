export type RuntimeMode = 'local' | 'server'

export interface RuntimeModeResult {
  mode: RuntimeMode
  bootstrapRequired?: boolean
}

export class RuntimeModeError extends Error {
  readonly code = 'SERVER_UNAVAILABLE'

  constructor(message = 'The family calendar server is unavailable.') {
    super(message)
    this.name = 'RuntimeModeError'
  }
}

interface ModeResponse {
  mode: 'server'
  bootstrapRequired: boolean
}

export async function resolveRuntimeMode(options: {
  configuredMode: RuntimeMode
  fetcher?: typeof fetch
}): Promise<RuntimeModeResult> {
  if (options.configuredMode === 'local') return { mode: 'local' }

  try {
    const response = await (options.fetcher ?? fetch)('/api/mode', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`mode endpoint returned ${response.status}`)
    const data = (await response.json()) as ModeResponse
    if (data.mode !== 'server' || typeof data.bootstrapRequired !== 'boolean') {
      throw new Error('invalid server mode response')
    }
    return { mode: 'server', bootstrapRequired: data.bootstrapRequired }
  } catch {
    throw new RuntimeModeError()
  }
}

export const configuredRuntimeMode: RuntimeMode =
  import.meta.env.VITE_APP_MODE === 'server' ? 'server' : 'local'
