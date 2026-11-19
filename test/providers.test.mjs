/* Host-half harness: route registration, provider discovery, DeepSeek balance and MiniMax plan parsing. */
const pluginPath = new URL('../index.js', import.meta.url)
const { apply } = await import(pluginPath.href)

const results = []
const check = (name, condition, extra) => {
  results.push({ name, ok: Boolean(condition), extra })
}

const directory = [
  {
    provider: 'deepseek-official',
    displayName: 'DeepSeek',
    settingsNs: 'llm-deepseek',
    settingsPath: [],
    defaultBaseURL: 'https://api.deepseek.com/anthropic',
    nativeAuth: { env: ['DEEPSEEK_API_KEY'], oauth: false },
  },
  {
    provider: 'minimax',
    displayName: 'MiniMax',
    settingsNs: 'llm-pi-ai',
    settingsPath: ['providers', 'minimax'],
    defaultBaseURL: 'https://api.minimax.io/anthropic',
    nativeAuth: { env: ['MINIMAX_API_KEY'], oauth: false },
  },
  {
    provider: 'minimax-cn',
    displayName: 'MiniMax CN',
    settingsNs: 'llm-pi-ai',
    settingsPath: ['providers', 'minimax-cn'],
    defaultBaseURL: 'https://api.minimaxi.com/anthropic',
    nativeAuth: { env: ['MINIMAX_CN_API_KEY'], oauth: false },
  },
  {
    provider: 'moonshotai',
    displayName: 'Moonshot',
    settingsNs: 'llm-pi-ai',
    settingsPath: ['providers', 'moonshotai'],
    defaultBaseURL: 'https://api.moonshot.cn/v1',
    nativeAuth: { env: ['MOONSHOT_API_KEY'], oauth: false },
  },
  {
    provider: 'zai',
    displayName: 'Z.AI',
    settingsNs: 'llm-pi-ai',
    settingsPath: ['providers', 'zai'],
    defaultBaseURL: 'https://api.z.ai/api/paas/v4',
    nativeAuth: { env: ['ZAI_API_KEY'], oauth: false },
  },
  {
    provider: 'dormant-catalog-entry',
    displayName: 'Some catalog provider',
    settingsNs: 'llm-pi-ai',
    settingsPath: ['providers', 'dormant-catalog-entry'],
    defaultBaseURL: 'https://api.example.com/v1',
    nativeAuth: { env: ['EXAMPLE_API_KEY'], oauth: false },
  },
]

const settingsValue = {
  providers: {
    minimax: { apiKeyEnv: 'MINIMAX_API_KEY', baseURL: 'https://api.minimax.io/anthropic' },
    'minimax-cn': { apiKeyEnv: 'MINIMAX_CN_API_KEY', baseURL: 'https://api.minimaxi.com/anthropic' },
    moonshotai: { apiKeyEnv: 'MOONSHOT_API_KEY' },
    zai: { apiKeyEnv: 'ZAI_API_KEY' },
  },
}

const deepseekSection = { apiKeyEnv: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com/anthropic' }

const credentials = {
  DEEPSEEK_API_KEY: 'sk-deepseek-test',
  MINIMAX_API_KEY: 'sk-minimax-test',
  MINIMAX_CN_API_KEY: 'sk-minimax-cn-test',
  MOONSHOT_API_KEY: 'sk-moonshot-test',
  ZAI_API_KEY: 'sk-zai-test',
}

const calls = []
const balanceBody = {
  is_available: true,
  balance_infos: [{ currency: 'CNY', total_balance: '110.00', granted_balance: '10.00', topped_up_balance: '100.00' }],
}
const minimaxBody = {
  base_resp: { status_code: 0, status_msg: 'success' },
  model_remains: [
    {
      model_name: 'MiniMax-M2.5',
      end_time: Date.now() + 3600_000,
      current_interval_total_count: 1500,
      current_interval_usage_count: 1245,
      current_interval_remaining_percent: 83,
      weekly_end_time: Date.now() + 86400_000,
      current_weekly_total_count: 10000,
      current_weekly_usage_count: 8000,
      current_weekly_remaining_percent: 80,
    },
  ],
}
const minimaxNoPercentBody = {
  base_resp: { status_code: 0 },
  model_remains: [
    {
      model_name: 'MiniMax-M2.5',
      current_interval_total_count: 200,
      current_interval_usage_count: 50,
      current_weekly_total_count: 1000,
      current_weekly_usage_count: 250,
    },
  ],
}
const minimaxBusinessErrorBody = { base_resp: { status_code: 1004, status_msg: 'not authorized' } }

globalThis.fetch = async (url, init) => {
  const href = String(url)
  calls.push({ href, auth: init?.headers?.authorization })
  if (href === 'https://api.deepseek.com/user/balance') {
    return new Response(JSON.stringify(balanceBody), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (href === 'https://api.minimax.io/v1/token_plan/remains') {
    return new Response(JSON.stringify(minimaxBody), { status: 200 })
  }
  if (href === 'https://api.minimaxi.com/v1/token_plan/remains') {
    return new Response(JSON.stringify(minimaxBusinessErrorBody), { status: 200 })
  }
  if (href.endsWith('/v1/coding_plan/remains')) {
    return new Response(JSON.stringify(minimaxNoPercentBody), { status: 200 })
  }
  return new Response(JSON.stringify({}), { status: 500 })
}

let capturedRoute
const ctx = {
  get(name) {
    if (name === 'settings') {
      return {
        describe: () => [
          { ns: 'llm-deepseek', value: deepseekSection },
          { ns: 'llm-pi-ai', value: settingsValue },
        ],
      }
    }
    return undefined
  },
  llm: {
    listProviders: () => directory.filter((entry) => entry.provider !== 'dormant-catalog-entry').map((entry) => ({ id: entry.provider, name: entry.displayName })),
    listConfigurableProviders: () => directory,
  },
  credentials: {
    async resolve(name) {
      const value = credentials[name]
      return value === undefined ? undefined : { value, source: 'test' }
    },
  },
  connection: {
    fetch: {
      register(route) {
        capturedRoute = route
        return () => {}
      },
    },
  },
  effect(fn) {
    return fn()
  },
}

apply(ctx)

check('route registered', capturedRoute !== undefined)
check('route path', capturedRoute?.path === '/api/provider-usage/snapshot', capturedRoute?.path)
check('route method GET', JSON.stringify(capturedRoute?.methods) === '["GET"]')

const response = await capturedRoute.fetch(new Request('http://127.0.0.1:58615/api/provider-usage/snapshot'))
const snapshot = await response.json()
check('route responds 200', response.status === 200, response.status)
check('snapshot has generatedAt', typeof snapshot.generatedAt === 'string')
check('dormant catalog entry excluded', !snapshot.providers.some((p) => p.id === 'dormant-catalog-entry'))

const deepseek = snapshot.providers.find((p) => p.id === 'deepseek-official')
check('deepseek listed', deepseek !== undefined)
check('deepseek ok', deepseek?.status === 'ok', deepseek?.status)
check('deepseek total 110', deepseek?.balance?.total === 110, deepseek?.balance?.total)
check('deepseek topped up 100', deepseek?.balance?.toppedUp === 100, deepseek?.balance?.toppedUp)
check('deepseek granted 10', deepseek?.balance?.granted === 10, deepseek?.balance?.granted)
check('deepseek currency CNY', deepseek?.balance?.currency === 'CNY')
check('deepseek key not leaked', !JSON.stringify(snapshot).includes('sk-deepseek-test'))
check('deepseek bearer used', calls.some((call) => call.href === 'https://api.deepseek.com/user/balance' && call.auth === 'Bearer sk-deepseek-test'))

const minimax = snapshot.providers.find((p) => p.id === 'minimax')
check('minimax listed', minimax !== undefined)
check('minimax ok', minimax?.status === 'ok', minimax?.status)
check('minimax two windows', minimax?.plan?.windows?.length === 2, minimax?.plan?.windows?.length)
const fiveHour = minimax?.plan?.windows?.find((w) => w.key === '5h')
check('minimax 5h percent 83', fiveHour?.remainingPercent === 83, fiveHour?.remainingPercent)
check('minimax 5h used 17', fiveHour?.usedPercent === 17, fiveHour?.usedPercent)
check('minimax 5h total', fiveHour?.total === 1500)
check('minimax 5h reset ISO', typeof fiveHour?.resetAt === 'string' && fiveHour.resetAt.includes('T'))
check('minimax model name', minimax?.plan?.model === 'MiniMax-M2.5')
check('minimax token plan endpoint first', calls.some((c) => c.href === 'https://api.minimax.io/v1/token_plan/remains'))

const minimaxCn = snapshot.providers.find((p) => p.id === 'minimax-cn')
check('minimax-cn fallback to legacy path', minimaxCn?.status === 'ok', minimaxCn?.status)
const cnFive = minimaxCn?.plan?.windows?.find((w) => w.key === '5h')
check('minimax-cn percent derived 25', cnFive?.remainingPercent === 25, cnFive?.remainingPercent)
check('minimax-cn used derived 75', cnFive?.usedPercent === 75, cnFive?.usedPercent)
check('minimax-cn weekly derived 25', minimaxCn?.plan?.windows?.find((w) => w.key === 'weekly')?.remainingPercent === 25)
check('minimax-cn fallback called', calls.some((c) => c.href.startsWith('https://api.minimaxi.com/v1/coding_plan/remains')))

const moonshot = snapshot.providers.find((p) => p.id === 'moonshotai')
check('moonshot unsupported', moonshot?.status === 'unsupported', moonshot?.status)
check('moonshot not called', !calls.some((c) => c.href.includes('moonshot')))

const zai = snapshot.providers.find((p) => p.id === 'zai')
check('zai unsupported', zai?.status === 'unsupported')

// Second run: MiniMax business error on the new path, 401 for DeepSeek, and a missing key.
globalThis.fetch = async (url) => {
  const href = String(url)
  if (href === 'https://api.deepseek.com/user/balance') return new Response('{"error":"bad key"}', { status: 401 })
  if (href.endsWith('/v1/token_plan/remains')) return new Response(JSON.stringify(minimaxBusinessErrorBody), { status: 200 })
  if (href.endsWith('/v1/coding_plan/remains')) return new Response(JSON.stringify(minimaxNoPercentBody), { status: 200 })
  return new Response('{}', { status: 500 })
}
delete credentials.MINIMAX_CN_API_KEY

const forced = await capturedRoute.fetch(new Request('http://127.0.0.1:58615/api/provider-usage/snapshot?refresh=1'))
const second = await forced.json()
const deepseek2 = second.providers.find((p) => p.id === 'deepseek-official')
check('deepseek 401 classified', deepseek2?.status === 'error' && deepseek2?.code === 'unauthorized', `${deepseek2?.status}/${deepseek2?.code}`)
const minimax2 = second.providers.find((p) => p.id === 'minimax')
check('minimax business error falls back', minimax2?.status === 'ok', minimax2?.status)
const minimaxCn2 = second.providers.find((p) => p.id === 'minimax-cn')
check('minimax-cn missing credential', minimaxCn2?.status === 'missing-credential', minimaxCn2?.status)
check('no family missing while configured', second.missing.length === 0, second.missing)

// Third run: a profile with DeepSeek but no MiniMax route, which is what a user
// who has not added the provider in Settings → Models sees.
const catalogOnly = [
  {
    provider: 'deepseek-official',
    displayName: 'DeepSeek',
    settingsNs: 'llm-deepseek',
    settingsPath: [],
    defaultBaseURL: 'https://api.deepseek.com/anthropic',
    nativeAuth: { env: ['DEEPSEEK_API_KEY'], oauth: false },
  },
  {
    provider: 'minimax',
    displayName: 'MiniMax',
    settingsNs: 'llm-pi-ai',
    settingsPath: ['providers', 'minimax'],
    defaultBaseURL: 'https://api.minimax.io/anthropic',
    nativeAuth: { env: ['MINIMAX_API_KEY'], oauth: false },
  },
  {
    provider: 'minimax-cn',
    displayName: 'MiniMax CN',
    settingsNs: 'llm-pi-ai',
    settingsPath: ['providers', 'minimax-cn'],
    defaultBaseURL: 'https://api.minimaxi.com/anthropic',
    nativeAuth: { env: ['MINIMAX_CN_API_KEY'], oauth: false },
  },
]

const catalogCredentials = { DEEPSEEK_API_KEY: 'sk-deepseek-test' }
let catalogRoute
const catalogCtx = {
  get(name) {
    if (name === 'settings') {
      return { describe: () => [{ ns: 'llm-deepseek', value: { apiKeyEnv: 'DEEPSEEK_API_KEY' } }] }
    }
    return undefined
  },
  llm: {
    listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }],
    listConfigurableProviders: () => catalogOnly,
  },
  credentials: {
    async resolve(name) {
      const value = catalogCredentials[name]
      return value === undefined ? undefined : { value, source: 'test' }
    },
  },
  connection: { fetch: { register: (registered) => { catalogRoute = registered; return () => {} } } },
  effect: (fn) => fn(),
}

globalThis.fetch = async (url) => {
  const href = String(url)
  if (href === 'https://api.deepseek.com/user/balance') return new Response(JSON.stringify(balanceBody), { status: 200 })
  return new Response('{}', { status: 500 })
}

apply(catalogCtx)
const catalogRead = async () => (await catalogRoute.fetch(new Request('http://127.0.0.1/api/provider-usage/snapshot?refresh=1'))).json()

const notAdded = await catalogRead()
check('only DeepSeek listed', notAdded.providers.length === 1 && notAdded.providers[0].id === 'deepseek-official')
check('MiniMax reported missing once', notAdded.missing.length === 1, notAdded.missing)
check('MiniMax missing family', notAdded.missing[0]?.family === 'minimax', notAdded.missing[0]?.family)
check('MiniMax missing label', notAdded.missing[0]?.label === 'MiniMax', notAdded.missing[0]?.label)
check('MiniMax reason not-configured', notAdded.missing[0]?.reason === 'not-configured', notAdded.missing[0]?.reason)

catalogCredentials.MINIMAX_CN_API_KEY = 'sk-minimax-cn-test'
const keyWithoutRoute = await catalogRead()
check('key without route detected', keyWithoutRoute.missing[0]?.reason === 'key-without-route', keyWithoutRoute.missing[0]?.reason)
check('still no MiniMax card', keyWithoutRoute.providers.length === 1)

const failures = results.filter((r) => !r.ok)
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.extra === undefined ? '' : `  (${JSON.stringify(result.extra)})`}`)
}
console.log(`\n${results.length - failures.length}/${results.length} passed`)
if (failures.length > 0) process.exitCode = 1
