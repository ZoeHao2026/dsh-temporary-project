/**
 * Browser half of the Temporary Project bundle.
 *
 * Contributes one compact "Temporary conversation" option to the New Session
 * hero row. The option calls the bundle's authenticated Host channel, which
 * creates a fresh project directory and Workspace, then opens a blank Session
 * in that Workspace through the shipped Workspace navigation.
 *
 * Plain browser module: it imports no Harness Client package, only the
 * baseline React external provided by the module table, and styles itself
 * through the host's `--dsw-alias-*` theme tokens.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-temporary-project',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const Fragment = React.Fragment

    /** Locale namespace registered by this bundle. */
    const NS = 'temporaryProject'

    /** Connection channel and endpoint owned by the package's Host half. */
    const API_CHANNEL = '/api'
    const API_ENDPOINT = 'temporary-project'

    /** How long to wait for the new Workspace to reach the client projection. */
    const WORKSPACE_WAIT_MS = 5000

    /** How long one error notice stays visible. */
    const NOTICE_MS = 8000

    /** Simplified Chinese dictionary (the key-set source of truth). */
    const zh = {
      'option': '临时对话',
      'option.description': '临时对话：自动创建临时项目并直接开始会话',
      'creating': '正在创建临时项目…',
      'workspaceTitle': '临时项目',
      'error.create': '无法创建临时项目：{message}',
      'error.list': '临时项目已创建，但项目列表尚未刷新；请稍后从项目列表打开。'
    }

    /** English dictionary, checked complete against the zh key set. */
    const en = {
      'option': 'Temporary conversation',
      'option.description': 'Temporary conversation: create a temporary project and start right away',
      'creating': 'Creating temporary project…',
      'workspaceTitle': 'Temporary project',
      'error.create': 'Could not create a temporary project: {message}',
      'error.list': 'The temporary project was created, but the project list has not refreshed yet. Open it from the project list in a moment.'
    }

    /**
     * Describe one caught value for a notice.
     * @param {unknown} error - caught value.
     * @returns {string} a short message.
     */
    function messageOf(error) {
      if (error instanceof Error) return error.message
      const message = /** @type {{ message?: unknown }} */ (error)?.message
      return typeof message === 'string' && message !== '' ? message : String(error)
    }

    /**
     * Format the short local timestamp stored in a Workspace title.
     * @returns {string} a date-and-time stamp.
     */
    function timeStamp() {
      try {
        return new Intl.DateTimeFormat(undefined, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(new Date())
      } catch {
        return new Date().toISOString().slice(5, 16).replace('T', ' ')
      }
    }

    /**
     * Create the overlay notice source shared by the action and its toast.
     * A published notice clears itself after {@link NOTICE_MS}; the timer is
     * owned by the store so a remounted toast never re-shows an expired one.
     * @returns {{
     *   getSnapshot: () => { seq: number, text: string } | null,
     *   subscribe: (listener: () => void) => () => void,
     *   publish: (text: string) => void,
     *   dispose: () => void,
     * }} the store.
     */
    function createNoticeStore() {
      let current = null
      let seq = 0
      let timer
      const listeners = new Set()
      const notify = () => {
        for (const listener of [...listeners]) {
          try {
            listener()
          } catch (error) {
            console.error('[temporary-project] notice listener threw:', error)
          }
        }
      }
      const expire = () => {
        timer = undefined
        current = null
        notify()
      }
      return {
        getSnapshot: () => current,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        publish: (text) => {
          current = { seq: ++seq, text }
          if (timer !== undefined) clearTimeout(timer)
          timer = setTimeout(expire, NOTICE_MS)
          notify()
        },
        dispose: () => {
          if (timer !== undefined) clearTimeout(timer)
          timer = undefined
          current = null
          listeners.clear()
        }
      }
    }

    /** Inline folder-and-spark mark; decorative, drawn with currentColor. */
    function FolderSparkIcon() {
      return h('svg', {
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        'aria-hidden': true,
        focusable: false
      },
      h('path', {
        d: 'M1.75 4.25c0-.55.45-1 1-1h3.1c.28 0 .54.11.73.31l.96 1.04h6.71c.55 0 1 .45 1 1v6.15c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinejoin: 'round'
      }),
      h('path', {
        d: 'M12.25 1.4l.42 1.08 1.08.42-1.08.42-.42 1.08-.42-1.08L10.75 2.9l1.08-.42z',
        fill: 'currentColor'
      }))
    }

    /** Inline busy arc; hidden from assistive technology. */
    function BusyIcon() {
      return h('svg', {
        width: 16,
        height: 16,
        viewBox: '0 0 16 16',
        'aria-hidden': true,
        focusable: false
      },
      h('circle', {
        cx: 8,
        cy: 8,
        r: 5.6,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeOpacity: 0.28
      }),
      h('path', {
        d: 'M13.6 8A5.6 5.6 0 0 0 8 2.4',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round'
      }))
    }

    /** Action chip styles, matched to the hero's WorkspaceChip. */
    const OPTION_CSS = `
.dsh-tp-option{display:inline-flex;align-items:center;gap:4px;min-height:28px;max-width:100%;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer;white-space:nowrap}
.dsh-tp-option:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dsh-tp-option:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dsh-tp-option:disabled{cursor:default;opacity:.7}
.dsh-tp-option>svg{flex:none}
.dsh-tp-option[data-busy="true"]>svg{animation:dsh-tp-spin .9s linear infinite}
.dsh-tp-option-label{overflow:hidden;text-overflow:ellipsis}
@keyframes dsh-tp-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){.dsh-tp-option[data-busy="true"]>svg{animation:none}}
`

    /** Overlay notice styles. */
    const TOAST_CSS = `
.dsh-tp-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:80;box-sizing:border-box;max-width:min(560px,calc(100vw - 32px));padding:10px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px}
`

    /**
     * The compact New Session option.
     * @param {{
     *   run: () => Promise<void>,
     *   useRemoteAccess: (action: string) => boolean,
     *   t: (key: string, values?: Record<string, unknown>) => string,
     * }} props - injected and standard slot props.
     * @returns {null | import('react').ReactElement} the option chip.
     */
    function HeroOption({ run, useRemoteAccess, t }) {
      const canCreate = useRemoteAccess('session/create')
      const [busy, setBusy] = React.useState(false)
      const busyRef = React.useRef(false)
      if (!canCreate) return null
      const label = busy ? t('creating') : t('option')
      return h(Fragment, null,
        h('style', { 'data-temporary-project': 'option' }, OPTION_CSS),
        h('button', {
          type: 'button',
          className: 'dsh-tp-option',
          'data-busy': busy ? 'true' : 'false',
          'aria-busy': busy || undefined,
          'aria-label': t('option.description'),
          title: t('option.description'),
          disabled: busy,
          onClick: async () => {
            if (busyRef.current) return
            busyRef.current = true
            setBusy(true)
            try {
              await run()
            } finally {
              busyRef.current = false
              setBusy(false)
            }
          }
        },
        busy ? h(BusyIcon) : h(FolderSparkIcon),
        h('span', { className: 'dsh-tp-option-label' }, label)))
    }

    /**
     * One frame-wide error notice, replaced by later notices.
     * @param {{
     *   useNotice: (selector: (snapshot: { seq: number, text: string } | null) => unknown) => unknown,
     * }} props - injected slot props.
     * @returns {null | import('react').ReactElement} the notice toast.
     */
    function NoticeToast({ useNotice }) {
      const notice = /** @type {{ seq: number, text: string } | null } */ (useNotice((snapshot) => snapshot))
      if (notice === null) return null
      return h(Fragment, null,
        h('style', { 'data-temporary-project': 'notice' }, TOAST_CSS),
        h('div', {
          className: 'dsh-tp-toast',
          role: 'status',
          'aria-live': 'polite'
        }, notice.text))
    }

    /** Required client services. */
    const inject = ['slots', 'locale', 'connection', 'uiWorkspace', 'workspaces']

    /**
     * Mount the New Session option and its notice overlay.
     * @param {import('@deepseek-ai/cordis').Context} ctx - Client root context.
     * @returns {void}
     */
    function apply(ctx) {
      const notice = createNoticeStore()
      ctx.effect(() => () => notice.dispose(), 'temporary-project: notice timer')
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'temporary-project: dictionaries')
      const t = ctx.locale.bind(NS)

      /**
       * Wait until the new Workspace reaches this page's Workspace projection.
       * @param {string} workspaceId - Workspace identity returned by the Host.
       * @returns {Promise<boolean>} whether the Workspace became visible.
       */
      function waitForWorkspace(workspaceId) {
        const list = ctx.workspaces?.list
        if (list === undefined || typeof list.getSnapshot !== 'function') return Promise.resolve(true)
        const present = () => list.getSnapshot().items.some((item) => item.workspaceId === workspaceId)
        if (present()) return Promise.resolve(true)
        return new Promise((resolve) => {
          let settled = false
          let unsubscribe = () => {}
          let timer
          const finish = (value) => {
            if (settled) return
            settled = true
            unsubscribe()
            clearTimeout(timer)
            resolve(value)
          }
          unsubscribe = list.subscribe(() => {
            if (present()) finish(true)
          })
          if (settled) unsubscribe()
          timer = setTimeout(() => finish(present()), WORKSPACE_WAIT_MS)
        })
      }

      /** Create one temporary project and open its blank Session. */
      async function run() {
        const title = `${t('workspaceTitle')} · ${timeStamp()}`
        let result
        try {
          result = await ctx.connection.rpc.call(API_CHANNEL, API_ENDPOINT, { title })
        } catch (error) {
          console.error('[temporary-project] create request failed:', error)
          notice.publish(t('error.create', { message: messageOf(error) }))
          return
        }
        if (!result.ok) {
          const detail = result.error ?? { code: 'gateway/internal', message: 'unknown failure' }
          console.warn('[temporary-project] host refused to create the project:', detail)
          notice.publish(t('error.create', { message: messageOf(detail) }))
          return
        }
        const workspaceId = result.value?.workspaceId
        if (typeof workspaceId !== 'string' || workspaceId === '') {
          console.warn('[temporary-project] host response carried no workspaceId:', result.value)
          notice.publish(t('error.create', { message: 'host response carried no workspaceId' }))
          return
        }
        const listed = await waitForWorkspace(workspaceId)
        if (!listed) {
          notice.publish(t('error.list'))
          return
        }
        try {
          await ctx.uiWorkspace.openWorkspace(workspaceId)
        } catch (error) {
          // ui-workspace reports creation failures through its own notice channel.
          console.warn('[temporary-project] opening the temporary project failed:', error)
        }
      }

      ctx.slots.inject('conversation.hero.options', () => ctx.slots.register({
        name: 'conversation.hero.options',
        id: 'temporary-project',
        order: 100,
        locale: NS,
        inject: () => ({
          run,
          hooks: { notice }
        })
      }, HeroOption))

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'temporary-project-notice',
        order: 900,
        locale: NS,
        inject: () => ({ hooks: { notice } })
      }, NoticeToast))
    }

    return { inject, apply }
  }
})
