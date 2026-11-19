/**
 * Provider usage, Host half.
 *
 * Discovers the model-provider routes this profile actually configured, reads each
 * provider's balance or token-plan quota over its own API, and serves one JSON
 * snapshot to the Client page. Every credential is resolved on the Host and never
 * leaves it: the page only receives the numbers the providers reported.
 */

/** Services whose absence makes this plugin inactive rather than broken. */
export const inject = ['llm', 'credentials', 'connection']

/** Authenticated Fetch route the Client page reads. */
const ROUTE_PATH = '/api/provider-usage/snapshot'
/** Reuse one snapshot for this long unless the caller asks for a refresh. */
const CACHE_MS = 30_000
/** Per-provider request budget. */
const REQUEST_TIMEOUT_MS = 8_000

/**
 * Adapter families this plugin can report, each spanning the provider routes that
 * answer from the same account. A family with no configured route is reported as
 * missing so the page can say "not added yet" instead of staying silent.
 */
const FAMILIES = [
  { key: 'deepseek', kinds: ['deepseek', 'deepseek-account'], label: 'DeepSeek' },
  { key: 'minimax', kinds: ['minimax'], label: 'MiniMax' },
]

class ProviderError extends Error {
  constructor(code, detail) {
    super(detail ?? code)
    this.code = code
    this.detail = detail
  }
}

/**
 * Register the snapshot route.
 * @param ctx - Host context carrying the LLM, credential, and Connection services.
 */
export function apply(ctx) {
  let cached
  let pending

  const load = (force) => {
    if (!force && cached !== undefined && Date.now() - cached.at < CACHE_MS) {
      return Promise.resolve(cached.value)
    }
    if (pending !== undefined) return pending
    pending = readSnapshot(ctx)
      .then((value) => {
        cached = { at: Date.now(), value }
        return value
      })
      .finally(() => {
        pending = undefined
      })
    return pending
  }

  ctx.effect(() => ctx.connection.fetch.register({
    path: ROUTE_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        const force = new URL(request.url).searchParams.get('refresh') === '1'
        return jsonResponse(200, await load(force))
      } catch (error) {
        return jsonResponse(500, { error: messageOf(error) })
      }
    },
  }), 'provider-usage: snapshot route')
}

/**
 * Build one snapshot for every provider this profile configured, plus the adapter
 * families the profile has not configured yet.
 * @param ctx - Host context.
 * @returns generated time, one entry per provider, and the missing families.
 */
async function readSnapshot(ctx) {
  const { providers, directory } = discover(ctx)
  const entries = await Promise.all(providers.map((provider) => readProvider(ctx, provider)))
  const merged = mergeFamilies(entries)
  return {
    generatedAt: new Date().toISOString(),
    providers: merged,
    missing: await missingFamilies(ctx, merged, directory),
  }
}

/**
 * One card per provider family.
 *
 * The account route and the API-key route of one provider answer from the same
 * product, so listing both produces two cards for one balance. The family keeps
 * the entry that has data (the account route first) and reports the other entries
 * that also have data as sources of the same card; an entry with nothing to show
 * is dropped rather than repeated.
 * @param entries - one read result per provider route.
 * @returns one entry per family.
 */
function mergeFamilies(entries) {
  const groups = new Map()
  for (const entry of entries) {
    const family = familyOf(entry)
    const list = groups.get(family)
    if (list === undefined) groups.set(family, [entry])
    else list.push(entry)
  }

  const merged = []
  for (const [family, list] of groups) {
    if (list.length === 1) {
      merged.push({ ...list[0], family })
      continue
    }
    const withData = list.filter(hasData)
    const pool = withData.length > 0 ? withData : list
    const primary = pool.find((entry) => entry.kind === 'deepseek-account') ?? pool[0]
    const sources = pool
      .filter((entry) => entry !== primary)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        balance: entry.balance ?? null,
        plan: entry.plan ?? null,
      }))
    merged.push({ ...primary, family, sources })
  }
  return merged
}

/**
 * @param entry - provider entry.
 * @returns the account family its card belongs to.
 *
 * DeepSeek's account route and API-key route answer from one vendor account, so
 * they share a card. MiniMax's international and China sites are separate accounts
 * with separate keys, so their host keeps them apart.
 */
function familyOf(entry) {
  if (entry.kind === 'deepseek' || entry.kind === 'deepseek-account') return 'deepseek'
  if (entry.kind === 'minimax') return `minimax:${entry.host ?? 'default'}`
  return entry.id
}

/** @param entry - provider entry. @returns whether it produced any reading. */
function hasData(entry) {
  return entry.status === 'ok' && (entry.balance !== undefined && entry.balance !== null
    || entry.plan !== undefined && entry.plan !== null)
}

/**
 * Report the supported families with no configured route.
 *
 * A configured key without a route is the one state the user can fix in a single
 * step, so it is reported separately from a family that was never added.
 * @param ctx - Host context.
 * @param providers - provider entries already read.
 * @param directory - the configurable-provider directory.
 * @returns one record per absent family that the directory knows about.
 */
async function missingFamilies(ctx, providers, directory) {
  const present = new Set(providers.map((provider) => provider.kind))
  const missing = []
  for (const family of FAMILIES) {
    if (family.kinds.some((kind) => present.has(kind))) continue
    const entries = directory.filter((entry) => entry !== null
      && typeof entry === 'object'
      && family.kinds.includes(kindOf(entry.provider, hostOf(entry.defaultBaseURL))))
    if (entries.length === 0) continue
    const named = entries.find((entry) => isNonEmptyString(entry.displayName))
    let reason = 'not-configured'
    for (const entry of entries) {
      const names = Array.isArray(entry.nativeAuth?.env) ? entry.nativeAuth.env : []
      if (await resolveKey(ctx, names) !== undefined) {
        reason = 'key-without-route'
        break
      }
    }
    missing.push({
      family: family.key,
      label: named === undefined ? family.label : named.displayName,
      reason,
    })
  }
  return missing
}

/**
 * Join the configurable-provider directory with the live settings document.
 *
 * A provider is listed when its route is active or when the settings document
 * carries a profile for it; the dormant catalog entries that an adapter declares
 * before any route exists stay out of the way.
 * @param ctx - Host context.
 * @returns providers in directory order, plus the directory that produced them.
 */
function discover(ctx) {
  const sections = new Map()
  try {
    const settings = ctx.get('settings')
    const descriptors = settings === undefined ? [] : settings.describe()
    for (const descriptor of descriptors ?? []) {
      if (descriptor !== null && typeof descriptor === 'object' && typeof descriptor.ns === 'string') {
        sections.set(descriptor.ns, descriptor.value)
      }
    }
  } catch {
    // An unreadable settings document only costs profile overrides, not discovery.
  }

  const active = new Set()
  try {
    for (const info of ctx.llm.listProviders() ?? []) active.add(info.id)
  } catch {
    // Without an adapter registry nothing is active; profiles still list providers.
  }

  let directory = []
  try {
    directory = ctx.llm.listConfigurableProviders() ?? []
  } catch {
    directory = []
  }

  const seen = new Set()
  const providers = []
  for (const entry of directory) {
    if (entry === null || typeof entry !== 'object') continue
    if (typeof entry.provider !== 'string' || seen.has(entry.provider)) continue
    const profile = walk(sections.get(entry.settingsNs), entry.settingsPath)
    const isActive = active.has(entry.provider)
    const hasProfile = profile !== undefined && profile !== null
    if (!isActive && !hasProfile) continue
    seen.add(entry.provider)

    const profileObject = isRecord(profile) ? profile : {}
    const keyNames = unique([
      ...(typeof profileObject.apiKeyEnv === 'string' ? [profileObject.apiKeyEnv] : []),
      ...(Array.isArray(entry.nativeAuth?.env) ? entry.nativeAuth.env : []),
    ].filter(isNonEmptyString))
    const baseURL = isNonEmptyString(profileObject.baseURL)
      ? profileObject.baseURL
      : (isNonEmptyString(entry.defaultBaseURL) ? entry.defaultBaseURL : null)
    const host = hostOf(baseURL)

    providers.push({
      id: entry.provider,
      name: isNonEmptyString(entry.displayName) ? entry.displayName : entry.provider,
      baseURL,
      host,
      kind: kindOf(entry.provider, host),
      keyNames,
      active: isActive,
    })
  }
  return { providers, directory }
}

/**
 * Read one provider's quota without letting one failure fail the snapshot.
 * @param ctx - Host context.
 * @param provider - discovery record.
 * @returns a provider entry with `status` and, when available, `balance` or `plan`.
 */
async function readProvider(ctx, provider) {
  const base = {
    id: provider.id,
    name: provider.name,
    baseURL: provider.baseURL,
    host: provider.host,
    kind: provider.kind,
    active: provider.active,
    credentialRefs: provider.keyNames,
    credentialConfigured: false,
  }

  if (provider.kind === 'deepseek-account') {
    return readDeepSeekAccount(ctx, base)
  }
  if (provider.kind === 'unsupported') {
    return { ...base, status: 'unsupported' }
  }

  const key = await resolveKey(ctx, provider.keyNames)
  if (key === undefined) return { ...base, status: 'missing-credential' }
  const withKey = { ...base, credentialConfigured: true }

  try {
    if (provider.kind === 'deepseek') return { ...withKey, ...(await readDeepSeek(key)) }
    if (provider.kind === 'minimax') return { ...withKey, ...(await readMiniMax(provider.host, key)) }
    return { ...withKey, status: 'unsupported' }
  } catch (error) {
    return { ...withKey, status: 'error', code: codeOf(error), detail: messageOf(error) }
  }
}

/**
 * Read the signed-in DeepSeek account wallet balances through the account service.
 * @param ctx - Host context.
 * @param base - provider entry under construction.
 * @returns the provider entry.
 */
async function readDeepSeekAccount(ctx, base) {
  const account = ctx.get('deepseekAccount')
  if (account === undefined) return { ...base, status: 'unsupported' }
  const client = {
    version: '1.0.0',
    locale: 'zh_CN',
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  }
  try {
    const balance = await account.getBalance(client)
    if (balance === null || balance === undefined) {
      return { ...base, status: 'missing-credential', code: 'signed-out' }
    }
    if (balance.status !== 'ready') return { ...base, status: 'error', code: 'account' }
    const recharge = Array.isArray(balance.value) ? balance.value : []
    const bonus = Array.isArray(balance.bonusWallets) ? balance.bonusWallets : []
    const wallets = [
      ...recharge.map((wallet) => ({ wallet, bonus: false })),
      ...bonus.map((wallet) => ({ wallet, bonus: true })),
    ].map(({ wallet, bonus: isBonus }) => ({
      currency: String(wallet.currency ?? 'CNY'),
      total: num(wallet.balance),
      bonus: isBonus,
    }))
    const primary = wallets.find((wallet) => wallet.currency === 'CNY' && wallet.bonus === false)
      ?? wallets.find((wallet) => wallet.currency === 'CNY')
      ?? wallets[0]
    if (primary === undefined) return { ...base, status: 'error', code: 'shape' }
    return {
      ...base,
      status: 'ok',
      balance: {
        available: wallets.some((wallet) => typeof wallet.total === 'number' && wallet.total > 0),
        currency: primary.currency,
        total: primary.total,
        granted: primary.bonus === true ? primary.total : null,
        toppedUp: primary.bonus === true ? null : primary.total,
        wallets,
      },
    }
  } catch (error) {
    return { ...base, status: 'error', code: codeOf(error), detail: messageOf(error) }
  }
}

/**
 * Read the prepaid balance of one DeepSeek API key.
 * @param key - resolved API key.
 * @returns partial provider entry.
 */
async function readDeepSeek(key) {
  const json = await getJson('https://api.deepseek.com/user/balance', { authorization: `Bearer ${key}` })
  const infos = Array.isArray(json?.balance_infos) ? json.balance_infos : []
  if (infos.length === 0) throw new ProviderError('shape')
  const wallets = infos.map((info) => ({
    currency: String(info?.currency ?? 'CNY'),
    total: num(info?.total_balance),
    granted: num(info?.granted_balance),
    toppedUp: num(info?.topped_up_balance),
  }))
  const primary = wallets.find((wallet) => wallet.currency === 'CNY') ?? wallets[0]
  return {
    status: 'ok',
    balance: {
      available: json?.is_available !== false,
      currency: primary.currency,
      total: primary.total,
      granted: primary.granted,
      toppedUp: primary.toppedUp,
      wallets,
    },
  }
}

/**
 * Read one MiniMax Token Plan quota and retry the same host's legacy path.
 * @param host - the route's live inference host.
 * @param key - resolved API key.
 * @returns partial provider entry.
 */
async function readMiniMax(host, key) {
  const origin = `https://${host}`
  const paths = ['/v1/token_plan/remains', '/v1/coding_plan/remains']
  let first
  for (const path of paths) {
    try {
      const json = await getJson(origin + path, { authorization: `Bearer ${key}` })
      return { status: 'ok', plan: parseMiniMax(json) }
    } catch (error) {
      if (first === undefined) first = error
      const retryable = error instanceof ProviderError && (error.code === 'not-found' || error.code === 'business')
      if (!retryable) break
    }
  }
  throw first ?? new ProviderError('error')
}

/**
 * Map one `/v1/token_plan/remains` reply onto the two quota windows.
 * @param json - parsed reply.
 * @returns model label plus every window the reply described.
 */
function parseMiniMax(json) {
  const status = json?.base_resp
  if (isRecord(status) && typeof status.status_code === 'number' && status.status_code !== 0) {
    throw new ProviderError('business', String(status.status_msg ?? ''))
  }
  const rows = Array.isArray(json?.model_remains) ? json.model_remains.filter(isRecord) : []
  // The reply carries one bucket per model, and a bucket the plan does not cover
  // can report zeroed counts. Rank them so the account's real quota wins over a
  // placeholder row.
  const ranked = rows
    .map((candidate) => ({ candidate, score: windowScore(candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
  const row = ranked[0]?.candidate
  if (row === undefined) {
    const zeroed = rows.length > 0 && rows.every(isZeroBucket)
    throw new ProviderError(zeroed ? 'no-plan' : 'shape')
  }

  const windows = [
    miniMaxWindow('5h', row, 'current_interval', 'end_time'),
    miniMaxWindow('weekly', row, 'current_weekly', 'weekly_end_time'),
  ].filter((window) => window !== undefined)
  if (windows.length === 0) throw new ProviderError('shape')
  return {
    model: isNonEmptyString(row.model_name) ? row.model_name : null,
    windows,
  }
}

/**
 * Describe one MiniMax window.
 *
 * `current_*_usage_count` and `current_*_remaining_percent` both describe what is
 * *left* in the window despite the count's name, so the used share is derived from
 * the remaining percentage rather than from the counts.
 * @param key - stable window key the Client localizes.
 * @param row - one `model_remains` entry.
 * @param prefix - `current_interval` or `current_weekly`.
 * @param resetField - reset timestamp field of that window.
 * @returns the window, or undefined when the row has no such window.
 */
function miniMaxWindow(key, row, prefix, resetField) {
  if (!hasWindow(row, prefix)) return undefined
  const percent = numOrNull(row[`${prefix}_remaining_percent`])
  const total = numOrNull(row[`${prefix}_total_count`])
  const remaining = numOrNull(row[`${prefix}_usage_count`])
  const remainingPercent = percent !== null
    ? percent
    : (total !== null && total > 0 && remaining !== null ? (remaining / total) * 100 : null)
  const bounded = remainingPercent === null ? null : clamp(remainingPercent, 0, 100)
  return {
    key,
    remainingPercent: bounded,
    usedPercent: bounded === null ? null : clamp(100 - bounded, 0, 100),
    total,
    remaining,
    resetAt: isoFromMs(row[resetField]),
  }
}

/**
 * Classify a provider route by its live inference host.
 * @param id - provider route id.
 * @param host - inference host, or null.
 * @returns the adapter kind used by {@link readProvider}.
 */
function kindOf(id, host) {
  if (id === 'deepseek-account') return 'deepseek-account'
  if (host === 'api.deepseek.com') return 'deepseek'
  // The DeepSeek adapter publishes its endpoint as a placeholder rather than a
  // declared default, so an untouched profile carries no baseURL at all.
  if (host === null && id === 'deepseek-official') return 'deepseek'
  if (host !== null && (
    host === 'api.minimax.io'
    || host.endsWith('.minimax.io')
    || host === 'api.minimaxi.com'
    || host.endsWith('.minimaxi.com')
    || host.endsWith('.minimax.chat')
  )) return 'minimax'
  return 'unsupported'
}

/** @param baseURL - configured endpoint. @returns its hostname, or null. */
function hostOf(baseURL) {
  if (typeof baseURL !== 'string' || baseURL.length === 0) return null
  try {
    return new URL(baseURL).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** @param ms - millisecond timestamp. @returns ISO text, or null. */
function isoFromMs(ms) {
  const value = numOrNull(ms)
  if (value === null || value <= 0) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** @param row - model_remains entry. @param prefix - window prefix. */
function hasWindow(row, prefix) {
  return numOrNull(row[`${prefix}_remaining_percent`]) !== null
    || (numOrNull(row[`${prefix}_total_count`]) ?? 0) > 0
}

/**
 * Score one `model_remains` entry by how much real quota it describes.
 * @param row - model_remains entry.
 * @returns a positive score for a usable row, zero for a placeholder.
 */
function windowScore(row) {
  let score = 0
  if (numOrNull(row.current_interval_remaining_percent) !== null) score += 4
  if ((numOrNull(row.current_interval_total_count) ?? 0) > 0) score += 2
  if (numOrNull(row.current_weekly_remaining_percent) !== null) score += 2
  if ((numOrNull(row.current_weekly_total_count) ?? 0) > 0) score += 1
  return score
}

/**
 * @param row - model_remains entry.
 * @returns whether every count it carries is zero, which means "no active plan"
 * rather than "an unreadable reply".
 */
function isZeroBucket(row) {
  const fields = [
    'current_interval_total_count',
    'current_interval_usage_count',
    'current_weekly_total_count',
    'current_weekly_usage_count',
  ]
  return fields.every((field) => (numOrNull(row[field]) ?? 0) === 0)
}

/**
 * Resolve the first configured credential reference.
 * @param ctx - Host context.
 * @param names - candidate references, in lookup order.
 * @returns the secret, or undefined when none is configured.
 */
async function resolveKey(ctx, names) {
  for (const name of names) {
    try {
      const hit = await ctx.credentials.resolve(name)
      const value = isRecord(hit) ? hit.value : hit
      if (isNonEmptyString(value)) return value
    } catch {
      // A reference the store rejects is simply not configured; try the next one.
    }
  }
  return undefined
}

/**
 * Request JSON with the plugin's timeout and a classified failure.
 * @param url - absolute URL.
 * @param headers - request headers.
 * @returns parsed JSON.
 */
async function getJson(url, headers) {
  let response
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json', ...headers },
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new ProviderError(error?.name === 'TimeoutError' ? 'timeout' : 'network')
  }
  const text = await response.text()
  let json
  try {
    json = text.length === 0 ? undefined : JSON.parse(text)
  } catch {
    json = undefined
  }
  if (!response.ok) {
    const code = response.status === 401 ? 'unauthorized'
      : response.status === 403 ? 'forbidden'
        : response.status === 404 ? 'not-found'
          : response.status === 429 ? 'rate-limited'
            : 'http'
    throw new ProviderError(code, `HTTP ${response.status}`)
  }
  if (json === undefined) throw new ProviderError('shape')
  return json
}

/** @param status - HTTP status. @param value - JSON body. */
function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** @param error - thrown value. @returns its stable code. */
function codeOf(error) {
  if (error instanceof ProviderError) return error.code
  return error?.name === 'TimeoutError' ? 'timeout' : 'error'
}

/** @param error - thrown value. @returns a short detail string. */
function messageOf(error) {
  if (error instanceof ProviderError) return error.detail ?? error.code
  const message = error instanceof Error ? error.message : String(error)
  return message.length > 200 ? message.slice(0, 200) : message
}

/** @param value - any value. @returns whether it is a plain object. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param value - any value. @returns whether it is a non-empty string. */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

/** @param value - any value. @returns a finite number, or null. */
function numOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** @param value - any value. @returns a finite number, or null. */
function num(value) {
  return numOrNull(value)
}

/** @param value - any value. @param min - lower bound. @param max - upper bound. */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** @param values - candidate strings. @returns distinct values, in order. */
function unique(values) {
  const seen = new Set()
  const result = []
  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0 || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

/** @param value - settings section. @param path - settings path. @returns the nested value. */
function walk(value, path) {
  if (!Array.isArray(path) || path.length === 0) return value
  let current = value
  for (const segment of path) {
    if (!isRecord(current)) return undefined
    current = current[segment]
  }
  return current
}
