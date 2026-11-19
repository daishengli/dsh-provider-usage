/**
 * Provider usage, Client half.
 *
 * Registers the left-sidebar panel entry, its icon, and the page that reads the
 * Host snapshot from the authenticated `/api` route and renders one card per
 * provider. Everything the page shows is derived data; credentials stay on the Host.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-provider-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'providerUsage'
    const PANEL_ID = 'provider-usage'
    const ROUTE = 'api/provider-usage/snapshot'

    const zh = {
      panel: '提供商余额与套餐',
      title: '提供商余额与套餐',
      subtitle: '当前已配置的模型提供商：账户余额与 Token 套餐剩余',
      refresh: '刷新',
      refreshing: '刷新中…',
      updated: '更新于',
      loading: '正在读取提供商余额与套餐…',
      emptyTitle: '还没有可显示的提供商',
      emptyHint: '在「设置 → 模型」里配置 API 密钥后回到这里，就能看到余额与套餐。',
      loadFailed: '未能读取提供商余额与套餐',
      retry: '重试',
      balance: '账户余额',
      accountRoute: '账号',
      apiKeyRoute: 'API 密钥',
      toppedUp: '充值余额',
      granted: '赠金余额',
      plan: 'Token 套餐',
      planOf: 'Token 套餐 · {model}',
      window5h: '5 小时窗口',
      windowWeekly: '周窗口',
      usedPercent: '已用 {percent}%',
      usedLabel: '已用',
      remainingLine: '剩余 {percent}%',
      countsLeft: '剩余 {remaining} / {total}',
      resetAt: '{time} 重置',
      staleNotice: '未能刷新，下面是 {time} 的数据',
      staleNoticeNoTime: '未能刷新，下面是上次读取的数据',
      missingNotConfigured: '{label} 还没有添加：到「设置 → 模型」添加这个提供商后，这里会显示它的余额与套餐。',
      missingKeyWithoutRoute: '检测到 {label} 的 API 密钥，但还没有它的模型路由：到「设置 → 模型」添加后即可显示。',
      withDetail: '{text}（{detail}）',
      statusOk: '正常',
      statusInsufficient: '余额不足',
      statusMissing: '未配置密钥',
      statusUnsupported: '无查询接口',
      statusNoPlan: '无生效套餐',
      statusError: '查询失败',
      statusSignedOut: '尚未登录',
      hintMissing: '在「设置 → 模型」中填入该提供商的 API 密钥后会显示余额与套餐。',
      hintSignedOut: 'DeepSeek 账号尚未登录，登录后会显示钱包余额。',
      hintUnsupported: '该提供商没有公开的余额或套餐接口，这里不做估算。',
      hintNoPlan: '这个账号当前没有生效中的 Token 套餐，接口返回的额度是 0。',
      hintInsufficient: '账户已无可用余额，充值后即可继续调用。',
      errUnauthorized: 'API 密钥无效或已过期',
      errForbidden: '无权访问该接口',
      errNotFound: '接口不存在',
      errRateLimited: '请求过于频繁，请稍后再试',
      errNetwork: '无法连接到提供商接口',
      errTimeout: '请求超时',
      errShape: '返回数据无法识别',
      errBusiness: '提供商返回业务错误',
      errAccount: '账号额度暂时读取失败',
      errHttp: '接口返回错误',
      errGeneric: '读取失败',
    }

    const en = {
      panel: 'Provider quotas',
      title: 'Provider balances and plans',
      subtitle: 'Configured model providers: account balances and token-plan quota',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      updated: 'Updated',
      loading: 'Reading provider balances and plans…',
      emptyTitle: 'No provider to show yet',
      emptyHint: 'Configure an API key under Settings → Models, then come back here.',
      loadFailed: 'Could not read provider balances and plans',
      retry: 'Retry',
      balance: 'Account balance',
      accountRoute: 'Account',
      apiKeyRoute: 'API key',
      toppedUp: 'Topped up',
      granted: 'Granted balance',
      plan: 'Token plan',
      planOf: 'Token plan · {model}',
      window5h: '5-hour window',
      windowWeekly: 'Weekly window',
      usedPercent: '{percent}% used',
      usedLabel: 'used',
      remainingLine: '{percent}% left',
      countsLeft: '{remaining} / {total} left',
      resetAt: 'resets {time}',
      staleNotice: 'Could not refresh; showing data from {time}',
      staleNoticeNoTime: 'Could not refresh; showing the previous reading',
      missingNotConfigured: '{label} has not been added yet: add it under Settings → Models to see its balance and plan.',
      missingKeyWithoutRoute: 'A {label} API key is configured, but there is no model route for it yet. Add one under Settings → Models.',
      withDetail: '{text} ({detail})',
      statusOk: 'OK',
      statusInsufficient: 'Insufficient balance',
      statusMissing: 'No key',
      statusUnsupported: 'No quota API',
      statusNoPlan: 'No active plan',
      statusError: 'Failed',
      statusSignedOut: 'Signed out',
      hintMissing: 'Add this provider’s API key under Settings → Models to see its balance and plan.',
      hintSignedOut: 'Sign in to the DeepSeek account to see its wallet balance.',
      hintUnsupported: 'This provider publishes no balance or plan API, so nothing is estimated.',
      hintNoPlan: 'This account has no active token plan; the endpoint reported zero quota.',
      hintInsufficient: 'The account has no spendable balance; top it up to keep calling the API.',
      errUnauthorized: 'The API key is invalid or expired',
      errForbidden: 'This endpoint refused the request',
      errNotFound: 'The endpoint does not exist',
      errRateLimited: 'Rate limited; try again shortly',
      errNetwork: 'Could not reach the provider endpoint',
      errTimeout: 'The request timed out',
      errShape: 'The response shape was not recognized',
      errBusiness: 'The provider returned a business error',
      errAccount: 'The account quota could not be read right now',
      errHttp: 'The endpoint returned an error',
      errGeneric: 'Could not read the quota',
    }

    const C = {
      base: 'var(--dsw-alias-bg-base)',
      layer1: 'var(--dsw-alias-bg-layer-1)',
      border: 'var(--dsw-alias-border-l2)',
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      brand: 'var(--dsw-alias-brand-primary)',
      ok: 'var(--dsw-alias-state-success-primary)',
      warn: 'var(--dsw-alias-state-warn-primary)',
      warnLabel: 'var(--dsw-alias-state-warn-label, var(--dsw-alias-state-warn-primary))',
      error: 'var(--dsw-alias-state-error-primary)',
      idle: 'var(--dsw-alias-state-idle-primary)',
    }

    const ERROR_KEYS = {
      unauthorized: 'errUnauthorized',
      forbidden: 'errForbidden',
      'not-found': 'errNotFound',
      'rate-limited': 'errRateLimited',
      network: 'errNetwork',
      timeout: 'errTimeout',
      shape: 'errShape',
      business: 'errBusiness',
      account: 'errAccount',
      http: 'errHttp',
      error: 'errGeneric',
    }

    const CSS = `
.dsh-pu-btn { transition: background-color 120ms ease; }
.dsh-pu-btn:not(:disabled):hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-pu-btn:not(:disabled):active { background: var(--dsw-alias-interactive-bg-hover-accent); }
.dsh-pu-btn:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.dsh-pu-bar-fill { transition: width 240ms ease; }
@media (prefers-reduced-motion: reduce) {
  .dsh-pu-btn, .dsh-pu-bar-fill { transition: none; }
}
`

    /** Decorative wallet glyph; the sidebar owns the row label and color. */
    function PanelIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16
      return h('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': true,
        style: { display: 'block' },
      },
      h('rect', { x: 3.2, y: 6.4, width: 17.6, height: 12.2, rx: 3, stroke: 'currentColor', strokeWidth: 1.6 }),
      h('path', { d: 'M3.2 10.6h17.6', stroke: 'currentColor', strokeWidth: 1.6 }),
      h('circle', { cx: 16.4, cy: 14.6, r: 1.6, fill: 'currentColor' }))
    }

    /** @param props - locale-bound page props. */
    function ProviderPanel({ t }) {
      const [snapshot, setSnapshot] = React.useState(null)
      const [failure, setFailure] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [refreshing, setRefreshing] = React.useState(false)

      const load = React.useCallback((force) => {
        setFailure(null)
        if (force) setRefreshing(true)
        const url = force ? `${ROUTE}?refresh=1` : ROUTE
        return fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.json()
          })
          .then((data) => {
            if (data !== null && typeof data === 'object' && typeof data.error === 'string') {
              throw new Error(data.error)
            }
            setSnapshot(data)
          })
          .catch((error) => {
            const message = error instanceof Error && error.message.length > 0 ? error.message : ''
            setFailure(message)
          })
          .finally(() => {
            setLoading(false)
            setRefreshing(false)
          })
      }, [])

      React.useEffect(() => {
        load(false)
      }, [load])

      const raw = snapshot !== null && Array.isArray(snapshot.providers) ? snapshot.providers : []
      const providers = groupProviders(raw)
      const missing = snapshot !== null && Array.isArray(snapshot.missing) ? snapshot.missing : []
      const updated = snapshot !== null && typeof snapshot.generatedAt === 'string' ? clock(snapshot.generatedAt) : null
      const failed = failure !== null

      return h('div', { style: pageStyle },
        h('style', null, CSS),
        h('div', { style: columnStyle },
          h('div', { style: headerStyle },
            h('div', { style: { minWidth: 0 } },
              h('h1', { style: titleStyle }, t('title')),
              h('p', { style: subtitleStyle }, t('subtitle'))),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flex: 'none' } },
              updated === null ? null : h('span', { style: metaStyle }, `${t('updated')} ${updated}`),
              h('button', {
                type: 'button',
                className: 'dsh-pu-btn',
                onClick: () => load(true),
                disabled: refreshing || loading,
                style: buttonStyle(refreshing || loading),
              }, refreshing ? t('refreshing') : t('refresh')))),
          failed
            ? h('div', { style: noticeStyle, role: 'status' },
              h('div', { style: { fontWeight: 600 } }, t('loadFailed')),
              h('p', { style: hintStyle }, staleOrFailure(providers, updated, failure, t)),
              h('button', {
                type: 'button',
                className: 'dsh-pu-btn',
                onClick: () => load(true),
                style: { ...buttonStyle(false), marginTop: '12px' },
              }, t('retry')))
            : null,
          loading && !failed
            ? h('p', { style: { ...hintStyle, margin: '0' }, role: 'status', 'aria-live': 'polite' }, t('loading'))
            : null,
          !loading && !failed && providers.length === 0
            ? h('div', { style: noticeStyle },
              h('div', { style: { fontWeight: 600 } }, t('emptyTitle')),
              h('p', { style: hintStyle }, t('emptyHint')))
            : null,
          providers.length === 0
            ? null
            : h('div', { style: { display: 'grid', gap: '12px' } },
              providers.map((provider) => h(ProviderCard, { key: provider.id, provider, t }))),
          missing.length === 0
            ? null
            : h('div', { style: { display: 'grid', gap: '4px', marginTop: providers.length === 0 ? '8px' : '16px' } },
              missing.map((entry) => h('p', { key: entry.family, style: footnoteStyle },
                t(entry.reason === 'key-without-route' ? 'missingKeyWithoutRoute' : 'missingNotConfigured', { label: entry.label }))))))
    }

    /**
     * Collapse entries that share one account into one card.
     *
     * The Host already does this for a current payload, but an older Host speaks
     * per-route entries only, so the page repeats the rule: keep the route that has
     * a reading (the account route first) and hang the other readings off it. An
     * entry with nothing to show is dropped instead of repeated.
     * @param entries - provider entries from the snapshot.
     * @returns one entry per account family.
     */
    function groupProviders(entries) {
      const groups = new Map()
      for (const entry of entries) {
        if (entry === null || typeof entry !== 'object') continue
        const family = providerFamily(entry)
        const list = groups.get(family)
        if (list === undefined) groups.set(family, [entry])
        else list.push(entry)
      }
      const cards = []
      for (const [family, list] of groups) {
        if (list.length === 1) {
          cards.push({ ...list[0], family })
          continue
        }
        const withData = list.filter(hasReading)
        const pool = withData.length > 0 ? withData : list
        const primary = pool.find((entry) => entry.kind === 'deepseek-account') ?? pool[0]
        const inherited = Array.isArray(primary.sources) ? primary.sources : []
        const sources = pool
          .filter((entry) => entry !== primary)
          .map((entry) => ({
            id: entry.id,
            name: entry.name,
            kind: entry.kind,
            balance: entry.balance ?? null,
            plan: entry.plan ?? null,
          }))
        cards.push({ ...primary, family, sources: [...inherited, ...sources] })
      }
      return cards
    }

    /**
     * @param entry - provider entry.
     * @returns the account family the entry belongs to, tolerating an older Host.
     */
    function providerFamily(entry) {
      if (typeof entry.family === 'string' && entry.family.length > 0) return entry.family
      if (entry.kind === 'deepseek' || entry.kind === 'deepseek-account') return 'deepseek'
      if (entry.kind === 'minimax') return `minimax:${entry.host ?? 'default'}`
      const id = typeof entry.id === 'string' ? entry.id : ''
      if (id === 'deepseek-official' || id === 'deepseek-account' || id.startsWith('deepseek-')) return 'deepseek'
      if (id.startsWith('minimax')) return `minimax:${entry.host ?? 'default'}`
      return id
    }

    /** @param entry - provider entry. @returns whether it carries a reading. */
    function hasReading(entry) {
      const reading = (entry.balance !== undefined && entry.balance !== null)
        || (entry.plan !== undefined && entry.plan !== null)
      return reading && entry.status === 'ok'
    }

    /** @param props - one provider entry and the locale binding. */
    function ProviderCard({ provider, t }) {
      const status = statusOf(provider)
      const hint = hintOf(provider, t)
      return h('section', { style: cardStyle },
        h('header', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' } },
          h('div', { style: { minWidth: 0 } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
              h('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: status.tone, flex: 'none' } }),
              h('h2', { style: nameStyle }, provider.name ?? provider.id)),
            h('div', { style: routeStyle }, provider.host === undefined || provider.host === null ? provider.id : `${provider.id} · ${provider.host}`)),
          h('span', { style: badgeStyle }, t(status.labelKey))),
        provider.balance === undefined || provider.balance === null ? null : balanceBlock(provider.balance, t),
        provider.plan === undefined || provider.plan === null ? null : planBlock(provider.plan, t),
        sourcesBlock(provider.sources, t),
        hint === null ? null : h('p', { style: hintStyle }, hint))
    }

    /** @param sources - other routes of the same family that also produced data. */
    function sourcesBlock(sources, t) {
      const list = Array.isArray(sources) ? sources : []
      const rows = []
      for (const source of list) {
        if (source.balance !== undefined && source.balance !== null) {
          const currency = typeof source.balance.currency === 'string' ? source.balance.currency : 'CNY'
          rows.push([source.id, routeLabel(source, t), money(source.balance.total, currency)])
        } else if (source.plan !== undefined && source.plan !== null) {
          const window = Array.isArray(source.plan.windows) ? source.plan.windows[0] : undefined
          if (window !== undefined && typeof window.usedPercent === 'number') {
            rows.push([source.id, routeLabel(source, t), t('usedPercent', { percent: Math.round(window.usedPercent) })])
          }
        }
      }
      if (rows.length === 0) return null
      return h('dl', { style: { margin: '10px 0 0', display: 'grid', gap: '2px' } },
        rows.map(([key, label, value]) => h('div', { key, style: rowStyle },
          h('dt', { style: { margin: 0, color: C.muted } }, label),
          h('dd', { style: { margin: 0, color: C.text } }, value))))
    }

    /** @param source - merged route entry. @returns a label naming that route. */
    function routeLabel(source, t) {
      if (source.kind === 'deepseek-account') return t('accountRoute')
      if (source.kind === 'deepseek') return t('apiKeyRoute')
      return typeof source.name === 'string' && source.name.length > 0 ? source.name : String(source.id)
    }

    /** @param balance - Host balance record. @param t - locale binding. */
    function balanceBlock(balance, t) {
      const currency = typeof balance.currency === 'string' ? balance.currency : 'CNY'
      const rows = []
      if (typeof balance.toppedUp === 'number') rows.push([t('toppedUp'), balance.toppedUp])
      if (typeof balance.granted === 'number') rows.push([t('granted'), balance.granted])
      return h('div', { style: { marginTop: '14px' } },
        h('div', { style: sectionLabelStyle }, t('balance')),
        h('div', { style: amountStyle }, money(balance.total, currency)),
        rows.length === 0 ? null : h('dl', { style: { margin: '6px 0 0', display: 'grid', gap: '2px' } },
          rows.map(([label, value]) => h('div', { key: label, style: rowStyle },
            h('dt', { style: { margin: 0, color: C.muted } }, label),
            h('dd', { style: { margin: 0, color: C.text } }, money(value, currency))))))
    }

    /** @param plan - Host plan record. @param t - locale binding. */
    function planBlock(plan, t) {
      const windows = Array.isArray(plan.windows) ? plan.windows : []
      const model = typeof plan.model === 'string' && plan.model.length > 0 ? plan.model : null
      return h('div', { style: { marginTop: '14px' } },
        h('div', { style: sectionLabelStyle }, model === null ? t('plan') : t('planOf', { model })),
        windows.map((window) => windowRow(window, t)))
    }

    /** @param window - one quota window. @param t - locale binding. */
    function windowRow(window, t) {
      const remaining = typeof window.remainingPercent === 'number' ? window.remainingPercent : null
      const used = typeof window.usedPercent === 'number'
        ? window.usedPercent
        : (remaining === null ? null : Math.max(0, Math.min(100, 100 - remaining)))
      const low = remaining !== null && remaining < 20
      const reset = typeof window.resetAt === 'string' ? clock(window.resetAt) : null
      const name = windowLabel(window.key, t)
      const detail = typeof window.total === 'number' && window.total > 0 && typeof window.remaining === 'number'
        ? t('countsLeft', { remaining: formatCount(window.remaining), total: formatCount(window.total) })
        : (remaining === null ? null : t('remainingLine', { percent: Math.round(remaining) }))
      const footer = [detail, reset === null ? null : t('resetAt', { time: reset })].filter((part) => part !== null).join(' · ')
      return h('div', { key: window.key, style: { marginTop: '12px' } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' } },
          h('span', { style: { fontSize: '12px', color: C.muted } }, name),
          h('span', { style: { fontSize: '12px', fontWeight: 600, color: low ? C.warnLabel : C.text } },
            used === null ? '—' : t('usedPercent', { percent: Math.round(used) }))),
        used === null
          ? null
          : h('div', {
            role: 'progressbar',
            'aria-label': `${name} ${t('usedLabel')}`,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round(used),
            style: { marginTop: '6px', height: '6px', borderRadius: '999px', background: C.border, overflow: 'hidden' },
          },
          h('div', {
            className: 'dsh-pu-bar-fill',
            style: {
              width: `${Math.max(0, Math.min(100, used))}%`,
              height: '100%',
              borderRadius: '999px',
              background: low ? C.warn : C.brand,
            },
          })),
        footer.length === 0 ? null : h('div', { style: { marginTop: '4px', fontSize: '12px', color: C.muted } }, footer))
    }

    /** @param key - window key from the Host. @param t - locale binding. */
    function windowLabel(key, t) {
      if (key === '5h') return t('window5h')
      if (key === 'weekly') return t('windowWeekly')
      return String(key)
    }

    /** @param provider - provider entry. @returns tone and label key. */
    function statusOf(provider) {
      if (provider.balance !== undefined && provider.balance !== null && provider.balance.available === false) {
        return { tone: C.warn, labelKey: 'statusInsufficient' }
      }
      if (provider.status === 'ok') return { tone: C.ok, labelKey: 'statusOk' }
      if (provider.code === 'no-plan') return { tone: C.idle, labelKey: 'statusNoPlan' }
      if (provider.status === 'missing-credential') {
        return provider.code === 'signed-out'
          ? { tone: C.idle, labelKey: 'statusSignedOut' }
          : { tone: C.warn, labelKey: 'statusMissing' }
      }
      if (provider.status === 'unsupported') return { tone: C.idle, labelKey: 'statusUnsupported' }
      return { tone: C.error, labelKey: 'statusError' }
    }

    /** @param provider - provider entry. @param t - locale binding. @returns hint text or null. */
    function hintOf(provider, t) {
      if (provider.balance !== undefined && provider.balance !== null && provider.balance.available === false) {
        return t('hintInsufficient')
      }
      if (provider.code === 'no-plan') return t('hintNoPlan')
      if (provider.status === 'ok') return null
      if (provider.status === 'unsupported') return t('hintUnsupported')
      if (provider.status === 'missing-credential') {
        return provider.code === 'signed-out' ? t('hintSignedOut') : t('hintMissing')
      }
      const key = ERROR_KEYS[provider.code]
      const text = key === undefined ? t('errGeneric') : t(key)
      return typeof provider.detail === 'string' && provider.detail.length > 0 && provider.detail !== provider.code
        ? t('withDetail', { text, detail: provider.detail })
        : text
    }

    /** @param failure - raw transport failure text. @param t - locale binding. */
    function localizedFailure(failure, t) {
      if (/HTTP 401/.test(failure)) return t('errUnauthorized')
      if (/HTTP 403/.test(failure)) return t('errForbidden')
      if (/HTTP 404/.test(failure)) return t('errNotFound')
      if (/HTTP 429/.test(failure)) return t('errRateLimited')
      if (/fetch|Failed to fetch|NetworkError/i.test(failure)) return t('errNetwork')
      return failure.length > 0 ? t('withDetail', { text: t('errGeneric'), detail: failure }) : t('errGeneric')
    }

    /**
     * Explain a failed refresh without hiding the reading already on screen.
     * @param providers - providers from the last successful snapshot.
     * @param updated - clock text of that snapshot, or null.
     * @param failure - raw transport failure text.
     * @param t - locale binding.
     */
    function staleOrFailure(providers, updated, failure, t) {
      if (providers.length === 0) return localizedFailure(failure, t)
      return updated === null ? t('staleNoticeNoTime') : t('staleNotice', { time: updated })
    }

    /**
     * Format one wallet amount the way DSH's account page does: grouped digits,
     * two decimals truncated, a sub-cent positive balance as `<0.01`, and the sign
     * ahead of the currency symbol. Truncation goes through Intl so a value such as
     * 2.30 is not shown one cent low by binary floating point.
     * @param amount - number. @param currency - ISO code.
     */
    function money(amount, currency) {
      if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—'
      const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : ''
      const sign = amount < 0 ? '-' : ''
      const magnitude = Math.abs(amount)
      if (magnitude > 0 && magnitude < 0.01) return `${sign}<${symbol}0.01`
      return `${sign}${symbol}${formatAmount(magnitude)}${symbol === '' ? ` ${currency}` : ''}`
    }

    /** @param value - non-negative amount. @returns digits truncated to two decimals. */
    function formatAmount(value) {
      // Truncate arithmetically, then format an already two-decimal number: Intl's
      // `roundingMode` is newer than some engines that will load this bundle, and
      // binary floating point alone would show 2.30 as 2.29.
      const cents = Math.floor(value * 100 + 1e-9)
      return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
    }

    /** @param value - count. @returns whole digits with grouping. */
    function formatCount(value) {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
    }

    /** @param iso - ISO timestamp. @returns local clock text, or null. */
    function clock(iso) {
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return null
      const now = new Date()
      const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
      if (date.toDateString() === now.toDateString()) return time
      return `${date.getMonth() + 1}-${date.getDate()} ${time}`
    }

    /** @param value - number. */
    function pad(value) {
      return String(value).padStart(2, '0')
    }

    const pageStyle = {
      height: '100%',
      overflowY: 'auto',
      boxSizing: 'border-box',
      background: C.base,
      color: C.text,
      fontSize: '13px',
      lineHeight: '20px',
    }
    const columnStyle = {
      maxWidth: '960px',
      margin: '0 auto',
      padding: 'calc(28px + var(--dsh-frame-top-clearance, 0px)) clamp(24px, 4vw, 48px) 40px',
      boxSizing: 'border-box',
    }
    const headerStyle = {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '16px',
      marginBottom: '20px',
    }
    const titleStyle = { margin: 0, fontSize: '20px', lineHeight: '28px', fontWeight: 500, letterSpacing: 0 }
    const subtitleStyle = { margin: '4px 0 0', fontSize: '13px', lineHeight: '20px', color: C.muted }
    const metaStyle = { fontSize: '12px', color: C.muted }
    const cardStyle = {
      background: C.layer1,
      border: `1px solid ${C.border}`,
      borderRadius: '12px',
      padding: '16px',
      minWidth: 0,
    }
    const noticeStyle = {
      background: C.layer1,
      border: `1px solid ${C.border}`,
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
    }
    const nameStyle = {
      margin: 0,
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }
    const routeStyle = {
      marginTop: '2px',
      fontSize: '12px',
      color: C.muted,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }
    const sectionLabelStyle = { fontSize: '12px', color: C.muted }
    const amountStyle = { marginTop: '2px', fontSize: '18px', lineHeight: '24px', fontWeight: 600, letterSpacing: 0 }
    const rowStyle = { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px' }
    const hintStyle = { margin: '10px 0 0', fontSize: '12px', lineHeight: '18px', color: C.muted }
    const footnoteStyle = { margin: 0, fontSize: '12px', lineHeight: '18px', color: C.muted }

    const badgeStyle = {
      flex: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '2px 8px',
      borderRadius: '999px',
      border: `1px solid ${C.border}`,
      color: C.muted,
      fontSize: '12px',
      lineHeight: '18px',
      whiteSpace: 'nowrap',
    }

    /** @param disabled - whether the control currently refuses clicks. */
    function buttonStyle(disabled) {
      return {
        height: '36px',
        padding: '0 14px',
        borderRadius: '8px',
        border: `1px solid ${C.border}`,
        background: 'transparent',
        color: disabled ? C.muted : C.text,
        font: 'inherit',
        fontSize: '14px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }
    }

    // Test-only seam: exposes the pure helpers to test/client.test.mjs.
    if (typeof globalThis.__DSH_PROVIDER_USAGE_TEST_HOOK__ === 'function') {
      globalThis.__DSH_PROVIDER_USAGE_TEST_HOOK__({ groupProviders, providerFamily, money, formatCount })
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, {
          zh,
          en,
          ja: en,
          es: en,
          fr: en,
          de: en,
          ru: en,
          pt: en,
        }), 'provider-usage: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 20,
          locale: NS,
          label: () => t('panel'),
        }, PanelIcon))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, ProviderPanel))
      },
    }
  },
})
