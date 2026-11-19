/* Host-half harness: family merging, endpoint-less DeepSeek routes, and MiniMax row selection. */
const { apply } = await import(new URL('../index.js', import.meta.url).href)

const results = []
const check = (name, condition, extra) => results.push({ name, ok: Boolean(condition), extra })

const balanceBody = {
  is_available: true,
  balance_infos: [{ currency: 'CNY', total_balance: '12.00', granted_balance: '0.00', topped_up_balance: '12.00' }],
}
const accountWallets = { status: 'ready', value: [{ currency: 'CNY', balance: '65.27' }], bonusWallets: [] }

/**
 * Run one snapshot against a fake Host.
 * @param options - directory, active ids, settings sections, credentials, account balance, fetch stub.
 */
async function run(options) {
  let route
  const ctx = {
    get(name) {
      if (name === 'settings') return { describe: () => options.sections ?? [] }
      if (name === 'deepseekAccount') {
        return { getBalance: async () => options.account ?? null }
      }
      return undefined
    },
    llm: {
      listProviders: () => (options.active ?? []).map((id) => ({ id, name: id })),
      listConfigurableProviders: () => options.directory ?? [],
    },
    credentials: {
      async resolve(name) {
        const value = (options.credentials ?? {})[name]
        return value === undefined ? undefined : { value, source: 'test' }
      },
    },
    connection: { fetch: { register: (registered) => { route = registered; return () => {} } } },
    effect: (fn) => fn(),
  }
  globalThis.fetch = options.fetchImpl
  apply(ctx)
  return (await route.fetch(new Request('http://127.0.0.1/api/provider-usage/snapshot?refresh=1'))).json()
}

const deepseekEntry = (id, baseURL) => ({
  provider: id,
  displayName: id === 'deepseek-account' ? 'DeepSeek 账号' : 'DeepSeek',
  settingsNs: id === 'deepseek-account' ? 'llm-deepseek-account' : 'llm-deepseek',
  settingsPath: [],
  ...(baseURL === undefined ? {} : { defaultBaseURL: baseURL }),
  nativeAuth: { env: id === 'deepseek-account' ? [] : ['DEEPSEEK_API_KEY'], oauth: id === 'deepseek-account' },
})

const minimaxEntry = {
  provider: 'minimax',
  displayName: 'MiniMax',
  settingsNs: 'llm-pi-ai',
  settingsPath: ['providers', 'minimax'],
  defaultBaseURL: 'https://api.minimax.io/anthropic',
  nativeAuth: { env: ['MINIMAX_API_KEY'], oauth: false },
}

const okFetch = async (url) => {
  const href = String(url)
  if (href === 'https://api.deepseek.com/user/balance') {
    return new Response(JSON.stringify(balanceBody), { status: 200 })
  }
  return new Response('{}', { status: 500 })
}

// 1. Account route and API-key route both read: one card, the extra balance as a source row.
const both = await run({
  directory: [deepseekEntry('deepseek-account'), deepseekEntry('deepseek-official', 'https://api.deepseek.com/anthropic')],
  active: ['deepseek-account', 'deepseek-official'],
  sections: [{ ns: 'llm-deepseek', value: { apiKeyEnv: 'DEEPSEEK_API_KEY' } }],
  credentials: { DEEPSEEK_API_KEY: 'sk-test' },
  account: accountWallets,
  fetchImpl: okFetch,
})
check('one DeepSeek card', both.providers.length === 1, both.providers.map((p) => p.id))
check('family is deepseek', both.providers[0]?.family === 'deepseek', both.providers[0]?.family)
check('account is primary', both.providers[0]?.kind === 'deepseek-account', both.providers[0]?.kind)
check('account balance kept', both.providers[0]?.balance?.total === 65.27, both.providers[0]?.balance?.total)
check('api key balance is a source', both.providers[0]?.sources?.[0]?.balance?.total === 12, both.providers[0]?.sources)
check('no DeepSeek missing family', both.missing.length === 0, both.missing)

// 2. Account has data, the API-key route has no key: still one card, no extra notice.
const keyless = await run({
  directory: [deepseekEntry('deepseek-account'), deepseekEntry('deepseek-official')],
  active: ['deepseek-account', 'deepseek-official'],
  sections: [],
  credentials: {},
  account: accountWallets,
  fetchImpl: okFetch,
})
check('keyless route merged away', keyless.providers.length === 1, keyless.providers.map((p) => p.id))
check('keyless route not a source', (keyless.providers[0]?.sources ?? []).length === 0, keyless.providers[0]?.sources)

// 3. Endpoint-less official route with a key is still a DeepSeek balance read.
const noEndpoint = await run({
  directory: [deepseekEntry('deepseek-official')],
  active: ['deepseek-official'],
  sections: [{ ns: 'llm-deepseek', value: { apiKeyEnv: 'DEEPSEEK_API_KEY' } }],
  credentials: { DEEPSEEK_API_KEY: 'sk-test' },
  fetchImpl: okFetch,
})
check('endpoint-less route is deepseek', noEndpoint.providers[0]?.kind === 'deepseek', noEndpoint.providers[0]?.kind)
check('endpoint-less route reads balance', noEndpoint.providers[0]?.balance?.total === 12, noEndpoint.providers[0]?.balance?.total)
check('endpoint-less route not unsupported', noEndpoint.providers[0]?.status === 'ok', noEndpoint.providers[0]?.status)

// 4. MiniMax placeholder bucket first, real bucket second.
const placeholderFirst = {
  base_resp: { status_code: 0 },
  model_remains: [
    { model_name: 'placeholder', current_interval_total_count: 0, current_interval_usage_count: 0 },
    {
      model_name: 'MiniMax-M2.5',
      current_interval_total_count: 1500,
      current_interval_usage_count: 1245,
      current_interval_remaining_percent: 83,
      current_weekly_total_count: 10000,
      current_weekly_usage_count: 8000,
      current_weekly_remaining_percent: 80,
    },
  ],
}
const picked = await run({
  directory: [minimaxEntry],
  active: ['minimax'],
  sections: [{ ns: 'llm-pi-ai', value: { providers: { minimax: { apiKeyEnv: 'MINIMAX_API_KEY' } } } }],
  credentials: { MINIMAX_API_KEY: 'sk-minimax' },
  fetchImpl: async (url) => String(url).endsWith('/v1/token_plan/remains')
    ? new Response(JSON.stringify(placeholderFirst), { status: 200 })
    : new Response('{}', { status: 500 }),
})
check('real bucket chosen', picked.providers[0]?.plan?.model === 'MiniMax-M2.5', picked.providers[0]?.plan?.model)
check('real bucket percent', picked.providers[0]?.plan?.windows?.[0]?.remainingPercent === 83)
check('real bucket total', picked.providers[0]?.plan?.windows?.[0]?.total === 1500)

// 5. Only zeroed buckets: a clear failure instead of a 0/0 card.
const zeroed = await run({
  directory: [minimaxEntry],
  active: ['minimax'],
  sections: [{ ns: 'llm-pi-ai', value: { providers: { minimax: { apiKeyEnv: 'MINIMAX_API_KEY' } } } }],
  credentials: { MINIMAX_API_KEY: 'sk-minimax' },
  fetchImpl: async () => new Response(JSON.stringify({
    base_resp: { status_code: 0 },
    model_remains: [{ model_name: 'x', current_interval_total_count: 0, current_interval_usage_count: 0 }],
  }), { status: 200 }),
})
check('zeroed reply is an error', zeroed.providers[0]?.status === 'error', zeroed.providers[0]?.status)
check('zeroed reply is no-plan', zeroed.providers[0]?.code === 'no-plan', zeroed.providers[0]?.code)
check('zeroed reply has no plan', zeroed.providers[0]?.plan === undefined, zeroed.providers[0]?.plan)

// 6. Percent-only reply keeps the percentage and reports no counts.
const percentOnly = await run({
  directory: [minimaxEntry],
  active: ['minimax'],
  sections: [{ ns: 'llm-pi-ai', value: { providers: { minimax: { apiKeyEnv: 'MINIMAX_API_KEY' } } } }],
  credentials: { MINIMAX_API_KEY: 'sk-minimax' },
  fetchImpl: async () => new Response(JSON.stringify({
    base_resp: { status_code: 0 },
    model_remains: [{ model_name: 'MiniMax-M2.5', current_interval_remaining_percent: 60 }],
  }), { status: 200 }),
})
const percentWindow = percentOnly.providers[0]?.plan?.windows?.[0]
check('percent-only window kept', percentWindow?.remainingPercent === 60, percentWindow?.remainingPercent)
check('percent-only used derived', percentWindow?.usedPercent === 40, percentWindow?.usedPercent)
check('percent-only total absent', percentWindow?.total === null, percentWindow?.total)

const failures = results.filter((r) => !r.ok)
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.extra === undefined ? '' : `  (${JSON.stringify(result.extra)})`}`)
}
console.log(`\n${results.length - failures.length}/${results.length} passed`)
if (failures.length > 0) process.exitCode = 1
