import { isAuthEndpoint, refreshSession, resetRefreshStateForTests } from './authRefresh'

beforeEach(resetRefreshStateForTests)

/**
 * The single-flight guarantee is the whole point of this module, not an
 * optimisation. Production rotates refresh tokens and revokes the session on
 * reuse ("Token reuse detected. Session revoked.", verified against the live
 * API 2026-09-04), so a second concurrent refresh logs the user out rather
 * than merely wasting a request.
 */
describe('refreshSession', () => {
  it('makes ONE call when many callers ask at once', async () => {
    let release: () => void = () => {}
    const doRefresh = jest.fn(
      () => new Promise<void>((res) => { release = res })
    )

    const waiting = [
      refreshSession(doRefresh),
      refreshSession(doRefresh),
      refreshSession(doRefresh),
      refreshSession(doRefresh),
      refreshSession(doRefresh),
    ]
    release()
    const results = await Promise.all(waiting)

    expect(doRefresh).toHaveBeenCalledTimes(1)
    expect(results).toEqual([true, true, true, true, true])
  })

  it('gives every waiting caller the same failure, calling once', async () => {
    const doRefresh = jest.fn(() => Promise.reject(new Error('401')))

    const results = await Promise.all([
      refreshSession(doRefresh),
      refreshSession(doRefresh),
      refreshSession(doRefresh),
    ])

    expect(doRefresh).toHaveBeenCalledTimes(1)
    expect(results).toEqual([false, false, false])
  })

  it('allows a new attempt once the previous one has settled', async () => {
    const doRefresh = jest.fn(() => Promise.resolve())

    await refreshSession(doRefresh)
    await refreshSession(doRefresh)

    // Sequential attempts are two calls: the guard collapses concurrent
    // callers, it does not cache the outcome.
    expect(doRefresh).toHaveBeenCalledTimes(2)
  })

  it('never throws, even when the call rejects', async () => {
    await expect(refreshSession(() => Promise.reject(new Error('offline')))).resolves.toBe(false)
  })

  it('does not leave the guard stuck after a failure', async () => {
    const failing = jest.fn(() => Promise.reject(new Error('401')))
    await refreshSession(failing)

    const succeeding = jest.fn(() => Promise.resolve())
    await expect(refreshSession(succeeding)).resolves.toBe(true)
    expect(succeeding).toHaveBeenCalledTimes(1)
  })
})

describe('isAuthEndpoint', () => {
  it('excludes the endpoints that must never trigger a refresh', () => {
    expect(isAuthEndpoint('/auth/refresh')).toBe(true)
    expect(isAuthEndpoint('/auth/login')).toBe(true)
    expect(isAuthEndpoint('/auth/logout')).toBe(true)
    expect(isAuthEndpoint('/auth/register')).toBe(true)
  })

  it('leaves ordinary endpoints refreshable', () => {
    expect(isAuthEndpoint('/agents')).toBe(false)
    expect(isAuthEndpoint('/conversations?size=50')).toBe(false)
    expect(isAuthEndpoint(undefined)).toBe(false)
  })

  it('is not fooled by a lookalike path', () => {
    // A real endpoint that merely contains the word must still be refreshable,
    // or a genuine session expiry there would sign the user out.
    expect(isAuthEndpoint('/agents/auth/loginish')).toBe(false)
    expect(isAuthEndpoint('/auth/refresher')).toBe(false)
  })
})
