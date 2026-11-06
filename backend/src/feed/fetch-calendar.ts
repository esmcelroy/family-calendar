import { lookup as resolveAll } from 'node:dns/promises'
import { isIP, type LookupFunction } from 'node:net'
import { request as httpsRequest } from 'node:https'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 8_000

function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    const parts = address.split('.').map(Number)
    const a = parts[0] ?? 0
    const b = parts[1] ?? 0
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19)))
  }
  if (family !== 6) return false
  const normalized = address.toLowerCase()
  if (normalized.startsWith('::ffff:')) {
    const tail = normalized.slice(7)
    if (tail.includes('.')) return isPublicAddress(tail)
    const pieces = tail.split(':').filter(Boolean)
    if (pieces.length === 2) {
      const first = Number.parseInt(pieces[0] ?? '0', 16)
      const second = Number.parseInt(pieces[1] ?? '0', 16)
      return isPublicAddress(`${first >> 8}.${first & 255}.${second >> 8}.${second & 255}`)
    }
    return false
  }
  const firstSegment = Number.parseInt(normalized.split(':')[0] || '0', 16)
  return normalized !== '::' && normalized !== '::1' &&
    (firstSegment & 0xfe00) !== 0xfc00 &&
    (firstSegment & 0xffc0) !== 0xfe80 &&
    (firstSegment & 0xff00) !== 0xff00
}

export function raceWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error('Calendar subscription timed out.'))
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const onAbort = () => {
      cleanup()
      reject(new Error('Calendar subscription timed out.'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    operation.then(
      (value) => { cleanup(); resolve(value) },
      (error: unknown) => { cleanup(); reject(error) },
    )
  })
}

export function createPinnedLookup(
  hostname: string,
  address: { address: string; family: number },
): LookupFunction {
  return (requestedHostname, lookupOptions, callback) => {
    if (requestedHostname !== hostname) {
      callback(new Error('Unexpected DNS lookup') as NodeJS.ErrnoException, '', 0)
      return
    }
    if (typeof lookupOptions === 'object' && lookupOptions.all) {
      callback(null, [address])
    } else {
      callback(null, address.address, address.family)
    }
  }
}

async function safeAddress(hostname: string, signal: AbortSignal): Promise<{ address: string; family: number }> {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Calendar subscription host is not public.')
  }
  if (isIP(hostname)) throw new Error('Calendar subscription host is not public.')
  const addresses = await raceWithAbort(resolveAll(hostname, { all: true, verbatim: true }), signal)
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Calendar subscription host is not public.')
  }
  const address = addresses[0]
  if (!address) throw new Error('Calendar subscription host is not public.')
  return { address: address.address, family: address.family }
}

function requestPinned(url: URL, address: { address: string; family: number }, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    let bytes = 0
    const chunks: Buffer[] = []
    const request = httpsRequest(url, {
      method: 'GET',
      headers: { Accept: 'text/calendar, text/plain;q=0.9' },
      lookup: createPinnedLookup(url.hostname, address),
      servername: url.hostname,
      timeout: TIMEOUT_MS,
    }, (response) => {
      const status = response.statusCode ?? 0
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location
        response.resume()
        if (!location) {
          reject(new Error('Calendar subscription redirect was invalid.'))
          return
        }
        resolve(`REDIRECT:${location}`)
        return
      }
      if (status !== 200) {
        response.resume()
        reject(new Error('Calendar subscription request failed.'))
        return
      }
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > MAX_BYTES) {
          request.destroy(new Error('Calendar subscription is too large.'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      response.on('error', reject)
    })
    const abort = () => request.destroy(new Error('Calendar subscription timed out.'))
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
    request.once('close', () => signal.removeEventListener('abort', abort))
    request.on('timeout', () => request.destroy(new Error('Calendar subscription timed out.')))
    request.on('error', reject)
    request.end()
  })
}

export async function fetchCalendarSafely(value: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetchCalendarUntil(value, controller.signal)
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Calendar subscription timed out.')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchCalendarUntil(value: string, signal: AbortSignal): Promise<string> {
  let url = new URL(value)
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Calendar subscription must use HTTPS.')
    }
    const address = await safeAddress(url.hostname, signal)
    const response = await requestPinned(url, address, signal)
    if (!response.startsWith('REDIRECT:')) return response
    if (redirect === MAX_REDIRECTS) throw new Error('Calendar subscription redirected too many times.')
    url = new URL(response.slice('REDIRECT:'.length), url)
  }
  throw new Error('Calendar subscription could not be fetched.')
}
