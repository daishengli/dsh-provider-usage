/* Client-half harness: the card grouping rule, loaded through the module-loader shape. */
import { readFileSync } from 'node:fs'

const results = []
const check = (name, condition, extra) => results.push({ name, ok: Boolean(condition), extra })

let helpers
globalThis.__DSH_PROVIDER_USAGE_TEST_HOOK__ = (api) => { helpers = api }

const factorySource = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const define = (definition) => { globalThis.__registered = definition }
globalThis.window = { __ModuleLoader__: { load: define } }

const reactStub = {
  createElement: () => null,
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
}
const requireStub = (name) => {
  if (name === 'react') return reactStub
  throw new Error(`unexpected require: ${name}`)
}

// Evaluate the bundle the way the page does: register the factory, then run it.
new Function(factorySource)()
const module = globalThis.__registered.factory(requireStub)
check('factory returns apply', typeof module.apply === 'function')
check('factory declares slot + locale', JSON.stringify(module.inject) === '["slots","locale"]')
check('grouping hook reached', helpers !== undefined)

const group = helpers.groupProviders
const deepseekAccount = {
  id: 'deepseek-account',
  name: 'DeepSeek 账号',
  kind: 'deepseek-account',
  host: null,
  status: 'ok',
  balance: { currency: 'CNY', total: 65.27, granted: null, toppedUp: 65.27, available: true },
}
const deepseekOfficialKeyless = {
  id: 'deepseek-official',
  name: 'DeepSeek',
  kind: 'unsupported',
  host: null,
  status: 'unsupported',
}
const deepseekOfficialKeyed = {
  id: 'deepseek-official',
  name: 'DeepSeek',
  kind: 'deepseek',
  host: 'api.deepseek.com',
  status: 'ok',
  balance: { currency: 'CNY', total: 12, granted: 0, toppedUp: 12, available: true },
}
const minimaxIntl = { id: 'minimax', name: 'MiniMax', kind: 'minimax', host: 'api.minimax.io', status: 'ok', plan: { model: 'M2.5', windows: [] } }
const minimaxCn = { id: 'minimax-cn', name: 'MiniMax CN', kind: 'minimax', host: 'api.minimaxi.com', status: 'ok', plan: { model: 'M2.5', windows: [] } }

// 1. Old Host payload: an account card plus a data-less official route collapses to one.
const oldHost = group([deepseekAccount, deepseekOfficialKeyless])
check('old payload yields one card', oldHost.length === 1, oldHost.map((c) => c.id))
check('old payload keeps the account card', oldHost[0]?.id === 'deepseek-account', oldHost[0]?.id)
check('old payload drops the keyless route', (oldHost[0]?.sources ?? []).length === 0, oldHost[0]?.sources)

// 2. Old Host payload where both routes have a reading: one card, one source row.
const bothRead = group([deepseekAccount, deepseekOfficialKeyed])
check('both readings yield one card', bothRead.length === 1, bothRead.length)
check('account stays primary', bothRead[0]?.id === 'deepseek-account', bothRead[0]?.id)
check('api-key balance becomes a source', bothRead[0]?.sources?.[0]?.balance?.total === 12, bothRead[0]?.sources)

// 3. Current Host payload (already merged, family + sources present) passes through.
const alreadyMerged = group([{ ...deepseekAccount, family: 'deepseek', sources: [{ id: 'deepseek-official', kind: 'deepseek', balance: { currency: 'CNY', total: 12 } }] }])
check('merged payload is idempotent', alreadyMerged.length === 1, alreadyMerged.length)
check('merged payload keeps its source', alreadyMerged[0]?.sources?.length === 1, alreadyMerged[0]?.sources)

// 4. Two regional MiniMax accounts stay apart.
const minimaxBoth = group([minimaxIntl, minimaxCn])
check('minimax regions stay apart', minimaxBoth.length === 2, minimaxBoth.map((c) => c.id))

// 5. Unknown vendors keep one card each.
const others = group([
  { id: 'moonshotai', name: 'Moonshot', kind: 'unsupported', host: 'api.moonshot.cn', status: 'unsupported' },
  { id: 'zai', name: 'Z.AI', kind: 'unsupported', host: 'api.z.ai', status: 'unsupported' },
])
check('unknown vendors separate', others.length === 2, others.length)

// 6. A keyless-only DeepSeek route still renders as one card (nothing to merge with).
const lone = group([deepseekOfficialKeyless])
check('lone route still renders', lone.length === 1 && lone[0].status === 'unsupported')

// 7. Wallet amounts: truncated (never rounded up), grouped, sub-cent, sign before symbol.
const money = helpers.money
check('2.3 formats 2.30', money(2.3, 'CNY') === '¥2.30', money(2.3, 'CNY'))
check('1.15 formats 1.15', money(1.15, 'CNY') === '¥1.15', money(1.15, 'CNY'))
check('0.29 formats 0.29', money(0.29, 'CNY') === '¥0.29', money(0.29, 'CNY'))
check('2.01 formats 2.01', money(2.01, 'CNY') === '¥2.01', money(2.01, 'CNY'))
check('12.339 truncates', money(12.339, 'CNY') === '¥12.33', money(12.339, 'CNY'))
check('110 groups', money(110, 'CNY') === '¥110.00', money(110, 'CNY'))
check('1234.567 groups and truncates', money(1234.567, 'CNY') === '¥1,234.56', money(1234.567, 'CNY'))
check('sub-cent shows <0.01', money(0.004, 'CNY') === '<¥0.01', money(0.004, 'CNY'))
check('negative sign before symbol', money(-1.234, 'CNY') === '-¥1.23', money(-1.234, 'CNY'))
check('usd symbol', money(9.5, 'USD') === '$9.50', money(9.5, 'USD'))
check('other currency spells the code', money(9.5, 'EUR') === '9.50 EUR', money(9.5, 'EUR'))
check('missing amount is a dash', money(null, 'CNY') === '—', money(null, 'CNY'))
check('count grouping', helpers.formatCount(1245) === '1,245', helpers.formatCount(1245))

const failures = results.filter((r) => !r.ok)
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.extra === undefined ? '' : `  (${JSON.stringify(result.extra)})`}`)
}
console.log(`\n${results.length - failures.length}/${results.length} passed`)
if (failures.length > 0) process.exitCode = 1
