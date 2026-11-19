/* Host-half harness: DeepSeek account wallet path and wallet amount formatting. */
const { apply } = await import(new URL('../index.js', import.meta.url).href)

const results = []
const check = (name, condition, extra) => results.push({ name, ok: Boolean(condition), extra })

let walletValue = [{ currency: 'CNY', balance: '65.2768280200000000' }]
let bonusWallets = [{ currency: 'CNY', balance: '0' }]
let signedOut = false

let route
const directory = [{
  provider: 'deepseek-account',
  displayName: 'DeepSeek 账号',
  settingsNs: 'llm-deepseek-account',
  settingsPath: [],
  nativeAuth: { env: [], oauth: true },
}]

const ctx = {
  get(name) {
    if (name === 'deepseekAccount') {
      return {
        getBalance: async () => (signedOut ? null : { status: 'ready', value: walletValue, bonusWallets }),
      }
    }
    if (name === 'settings') return { describe: () => [] }
    return undefined
  },
  llm: {
    listProviders: () => [{ id: 'deepseek-account', name: 'DeepSeek 账号' }],
    listConfigurableProviders: () => directory,
  },
  credentials: { resolve: async () => undefined },
  connection: { fetch: { register: (registered) => { route = registered; return () => {} } } },
  effect: (fn) => fn(),
}

apply(ctx)

const read = async () => (await route.fetch(new Request('http://127.0.0.1/api/provider-usage/snapshot?refresh=1'))).json()

const first = await read()
const account = first.providers[0]
check('account card present', account?.id === 'deepseek-account')
check('account ok', account?.status === 'ok', account?.status)
check('account total parsed', account?.balance?.total === 65.27682802, account?.balance?.total)
check('account available true', account?.balance?.available === true, account?.balance?.available)
check('account toppedUp set', account?.balance?.toppedUp === 65.27682802, account?.balance?.toppedUp)
check('account granted null for recharge wallet', account?.balance?.granted === null, account?.balance?.granted)
check('no key needed', account?.credentialRefs?.length === 0)

walletValue = [{ currency: 'CNY', balance: '0' }]
bonusWallets = []
const empty = (await read()).providers[0]
check('empty wallet still ok', empty?.status === 'ok', empty?.status)
check('empty wallet available false', empty?.balance?.available === false, empty?.balance?.available)

walletValue = [{ currency: 'CNY', balance: '0' }]
bonusWallets = [{ currency: 'CNY', balance: '5.27' }]
const bonusOnly = (await read()).providers[0]
check('bonus-only available true', bonusOnly?.balance?.available === true, bonusOnly?.balance?.available)

signedOut = true
const out = (await read()).providers[0]
check('signed-out status', out?.status === 'missing-credential', out?.status)
check('signed-out code', out?.code === 'signed-out', out?.code)

const failures = results.filter((r) => !r.ok)
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.extra === undefined ? '' : `  (${JSON.stringify(result.extra)})`}`)
}
console.log(`\n${results.length - failures.length}/${results.length} passed`)
if (failures.length > 0) process.exitCode = 1
