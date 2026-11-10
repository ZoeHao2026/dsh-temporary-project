/**
 * Host-route unit checks for the Temporary Project bundle.
 *
 * Runs the real route logic against a throwaway project root and a fake
 * Workspace registry, so directory creation, title normalization, Connection
 * envelope handling, refusal paths, cancellation rollback, and failure
 * cleanup are exercised without a running Harness.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, createHandler, createRoute, ENDPOINT, ROUTE } from '../index.js'

const root = await mkdtemp(join(tmpdir(), 'dsh-tp-test-'))
const created = []
const registry = {
  create: async (path, title) => {
    created.push({ path, title })
    return { id: `ws-${created.length}`, path, title }
  },
  delete: async () => true
}
const envelope = (payload, rpcId = 'rpc-1', method = ENDPOINT) => new Request('http://dsh.internal/api/temporary-project', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'client-request', rpcId, method, payload })
})

try {
  // The bundle registers one exact Fetch route on Connection's `/api` handler.
  let registered
  apply({
    connection: {
      fetch: {
        register: (route) => {
          registered = route
          return () => {}
        }
      }
    },
    workspaceRegistry: registry
  })
  assert.equal(registered.path, ROUTE)
  assert.deepEqual(registered.methods, ['POST'])
  assert.equal(registered.requestBody, 'buffered')

  const route = createRoute({ workspaceRegistry: registry }, root)
  const call = async (request) => {
    const response = await route.fetch(request)
    return { response, body: await response.json() }
  }

  // Success: the Connection envelope is answered, the directory exists, the
  // title is normalized, and the Workspace is registered.
  const success = await call(envelope({ title: '  My   temp\nproject  ' }))
  assert.equal(success.response.status, 200)
  assert.equal(success.body.type, 'server-response')
  assert.equal(success.body.rpcId, 'rpc-1')
  assert.equal(success.body.result.ok, true)
  assert.equal(success.body.result.value.title, 'My temp project')
  assert.ok(success.body.result.value.path.startsWith(root))
  assert.equal(existsSync(success.body.result.value.path), true)
  assert.equal(created[0].title, 'My temp project')
  assert.equal(created[0].path, success.body.result.value.path)

  // Omitted title falls back to the localized-in-client default.
  const fallback = await call(envelope({}, 'rpc-2'))
  assert.equal(fallback.body.result.ok, true)
  assert.equal(fallback.body.result.value.title, 'Temporary project')

  // Titles are capped by code point; control characters cannot reach the
  // Workspace title and a surrogate pair is never split.
  const capped = await call(envelope({ title: `${'😀'.repeat(200)}\u0000` }, 'rpc-3'))
  assert.equal(capped.body.result.ok, true)
  assert.equal(Array.from(capped.body.result.value.title).length, 80)
  assert.equal(capped.body.result.value.title.isWellFormed(), true)
  assert.ok(!capped.body.result.value.title.includes('\u0000'))

  // Unknown endpoints are refused without touching the filesystem.
  const beforeUnknown = created.length
  const unknown = await call(envelope({}, 'rpc-4', 'other'))
  assert.equal(unknown.response.status, 200)
  assert.equal(unknown.body.result.ok, false)
  assert.equal(unknown.body.result.error.code, 'temporary-project/unknown-endpoint')
  assert.equal(created.length, beforeUnknown)

  // A malformed envelope is refused with the Connection request code.
  const malformed = await call(new Request('http://dsh.internal/api/temporary-project', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'nope', rpcId: 'rpc-5' })
  }))
  assert.equal(malformed.response.status, 200)
  assert.equal(malformed.body.result.ok, false)
  assert.equal(malformed.body.result.error.code, 'gateway/bad-request')

  // Registration failure removes the directory it just created, and every
  // failure branch carries a JSON-safe details record.
  let failedPath
  const failingRoute = createRoute({
    workspaceRegistry: {
      create: async (path) => {
        failedPath = path
        throw new Error('registry unavailable')
      },
      delete: async () => true
    }
  }, root)
  const failed = await (await failingRoute.fetch(envelope({ title: 'will fail' }, 'rpc-6'))).json()
  assert.equal(failed.result.ok, false)
  assert.equal(failed.result.error.code, 'temporary-project/workspace')
  assert.deepEqual(failed.result.error.details, {})
  assert.equal(JSON.stringify(failed.result.error.details), '{}')
  assert.equal(typeof failedPath, 'string')
  assert.equal(existsSync(failedPath), false)

  // An already-aborted call creates no directory.
  const aborted = new AbortController()
  aborted.abort()
  const create = createHandler({ workspaceRegistry: registry }, root)
  const beforeAbort = created.length
  const cancelled = await create({ title: 'aborted' }, aborted.signal)
  assert.equal(cancelled.ok, false)
  assert.equal(cancelled.error.code, 'gateway/cancelled')
  assert.equal(created.length, beforeAbort)

  // A caller that disconnects while registration is in flight rolls back both
  // the Workspace registration and the just-created directory.
  const controller = new AbortController()
  let rolledBackId
  let rolledBackPath
  const abortingCreate = createHandler({
    workspaceRegistry: {
      create: async (path, title) => {
        rolledBackPath = path
        controller.abort()
        return { id: 'ws-aborted', path, title }
      },
      delete: async (id) => {
        rolledBackId = id
        return true
      }
    }
  }, root)
  const rolledBack = await abortingCreate({ title: 'cancel after register' }, controller.signal)
  assert.equal(rolledBack.ok, false)
  assert.equal(rolledBack.error.code, 'gateway/cancelled')
  assert.equal(rolledBackId, 'ws-aborted')
  assert.equal(typeof rolledBackPath, 'string')
  assert.equal(existsSync(rolledBackPath), false)

  console.log('host-route.test.mjs: all assertions passed')
} finally {
  await rm(root, { recursive: true, force: true })
}
