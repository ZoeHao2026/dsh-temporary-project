/**
 * Host half of the Temporary Project bundle.
 *
 * Registers one exact Fetch route on Connection's shared `/api` handler. That
 * handler admits the request through Connection's Host/Origin fence and
 * browser authentication, dispatches only owner Peers to exact routes, and
 * hands the route a Fetch `Request`; the route speaks the Connection RPC
 * envelope used by `ctx.connection.rpc.call`.
 *
 * A call creates a fresh directory under the harness home, registers it as a
 * Workspace, and returns that Workspace identity so the browser half can open
 * a blank Session in it through the shipped Workspace navigation.
 *
 * This plugin contributes no model-facing state: no tool, prompt section, or
 * Session event is registered, so every request carries zero extra tokens.
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Loader entry id used by cordis.patch.yml. */
export const name = 'temporary-project'

/** Host services this bundle consumes. */
export const inject = ['connection', 'workspaceRegistry']

/** Exact Fetch route on Connection's shared `/api` handler. */
export const ROUTE = '/api/temporary-project'

/** Endpoint name carried inside the Connection RPC envelope. */
export const ENDPOINT = 'temporary-project'

/** Harness home: the profile-managed DSH_HOME, or the documented default. */
const HARNESS_HOME = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')

/** Fixed, user-visible root for automatically created temporary projects. */
const PROJECT_ROOT = join(HARNESS_HOME, 'temporary-projects')

/** Fallback Workspace title when the caller sends none. */
const DEFAULT_TITLE = 'Temporary project'

/** Longest accepted caller title, in Unicode code points. */
const TITLE_MAX = 80

/**
 * Build a successful generic RPC result.
 * @param {unknown} value - JSON-safe endpoint value.
 * @returns {{ ok: true, value: unknown }} the success branch.
 */
function ok(value) {
  return { ok: true, value }
}

/**
 * Build a failed generic RPC result.
 * @param {string} code - stable endpoint failure code.
 * @param {string} message - human-readable failure text.
 * @returns {{ ok: false, error: { code: string, message: string, details: Record<string, unknown> } }} the failure branch.
 */
function failure(code, message) {
  return { ok: false, error: { code, message, details: {} } }
}

/**
 * Describe one caught value without leaking a stack.
 * @param {unknown} error - caught value.
 * @returns {string} its message.
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Normalize a caller title into a single-line Workspace title.
 * @param {unknown} value - untrusted caller value.
 * @returns {string} the stored title.
 */
function normalizeTitle(value) {
  const raw = typeof value === 'string' ? value : ''
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const bounded = Array.from(cleaned === '' ? DEFAULT_TITLE : cleaned).slice(0, TITLE_MAX).join('')
  return bounded
}

/**
 * Remove one just-created project directory, ignoring failures.
 * @param {string} directory - absolute directory this route created.
 * @returns {Promise<void>} settles after the best-effort cleanup.
 */
async function removeDirectory(directory) {
  await rm(directory, { recursive: true, force: true }).catch(() => {})
}

/**
 * Build the create operation for one Host context and project root.
 * @param {{ workspaceRegistry: { create: (path: string, title?: string) => Promise<{ id: string, path: string, title: string }>, delete: (id: string) => Promise<boolean> } }} ctx - Host context.
 * @param {string} root - absolute parent directory for new projects.
 * @returns {(payload: unknown, signal?: AbortSignal) => Promise<unknown>} the endpoint operation.
 */
export function createHandler(ctx, root = PROJECT_ROOT) {
  return async (payload, signal) => {
    if (signal?.aborted) return failure('gateway/cancelled', 'request cancelled')
    const title = normalizeTitle(payload?.title)
    let directory
    try {
      await mkdir(root, { recursive: true })
      directory = await mkdtemp(join(root, 'project-'))
    } catch (error) {
      return failure('temporary-project/filesystem', `failed to create the temporary project directory: ${messageOf(error)}`)
    }
    if (signal?.aborted) {
      await removeDirectory(directory)
      return failure('gateway/cancelled', 'request cancelled')
    }
    let workspace
    try {
      workspace = await ctx.workspaceRegistry.create(directory, title)
    } catch (error) {
      await removeDirectory(directory)
      return failure('temporary-project/workspace', `failed to register the temporary project workspace: ${messageOf(error)}`)
    }
    if (signal?.aborted) {
      // The caller gave up while registration was in flight: undo both halves
      // instead of leaving an orphan Workspace pointing at an empty directory.
      await ctx.workspaceRegistry.delete(workspace.id).catch((error) => {
        ctx.logger?.warn(`temporary-project: could not roll back workspace "${workspace.id}" after cancellation: ${messageOf(error)}`)
      })
      await removeDirectory(directory)
      return failure('gateway/cancelled', 'request cancelled')
    }
    return ok({ workspaceId: workspace.id, path: workspace.path, title: workspace.title })
  }
}

/**
 * Build the exact Fetch route for one Host context and project root.
 * @param {{ workspaceRegistry: { create: (path: string, title?: string) => Promise<{ id: string, path: string, title: string }>, delete: (id: string) => Promise<boolean> } }} ctx - Host context.
 * @param {string} root - absolute parent directory for new projects.
 * @returns {{ path: string, methods: string[], requestBody: 'buffered', fetch: (request: Request) => Promise<Response> }} the Connection exact route.
 */
export function createRoute(ctx, root = PROJECT_ROOT) {
  const create = createHandler(ctx, root)
  return {
    path: ROUTE,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      /** @type {{ type?: unknown, rpcId?: unknown, method?: unknown, payload?: unknown }} */
      let envelope
      try {
        envelope = await request.json()
      } catch {
        envelope = {}
      }
      const rpcId = typeof envelope?.rpcId === 'string' ? envelope.rpcId : ''
      const respond = (result) => Response.json({ type: 'server-response', rpcId, result })
      if (envelope?.type !== 'client-request' || rpcId === '') {
        return respond(failure('gateway/bad-request', 'invalid client-request envelope'))
      }
      if (envelope.method !== ENDPOINT) {
        return respond(failure('temporary-project/unknown-endpoint', `unknown endpoint ${JSON.stringify(envelope.method)}`))
      }
      try {
        return respond(await create(envelope.payload, request.signal))
      } catch (error) {
        return respond(failure('temporary-project/internal', messageOf(error)))
      }
    }
  }
}

/**
 * Register the Temporary Project route.
 * @param {{ connection: { fetch: { register: (route: unknown) => unknown } }, workspaceRegistry: unknown }} ctx - Host context.
 * @returns {void}
 */
export function apply(ctx) {
  ctx.connection.fetch.register(createRoute(ctx))
}
