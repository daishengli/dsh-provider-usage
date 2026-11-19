/**
 * Build the plugin-index file DSH's Discover tab reads.
 *
 * Reads the package manifest, its localized display metadata, and the Git tag for
 * the current version, then writes `market/index.json` plus the icon it references.
 * Usage: `node market/build.mjs` (from the repository root).
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'market')
const outFile = join(outDir, 'index.json')

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const repoUrl = 'https://github.com/daishengli/dsh-provider-usage'
const tag = `v${manifest.version}`

/** @param {string[]} args @returns {string} trimmed stdout */
function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

/** @param {string} localeId @returns {object} the locale document */
function locale(localeId) {
  return JSON.parse(readFileSync(join(root, 'locale', `${localeId}.json`), 'utf8'))
}

let commit
let committedAt
try {
  commit = git(['rev-list', '-n', '1', tag])
  committedAt = Number(git(['show', '-s', '--format=%ct', commit]))
} catch {
  throw new Error(`Tag ${tag} is missing: create it before building the index.`)
}
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`Not a full commit hash: ${commit}`)

const zh = locale('zh').meta
const en = locale('en').meta

const index = {
  format: 1,
  title: { en: 'Lingcheng DSH plugins', zh: '灵城科技 DSH 插件' },
  description: {
    en: 'DSH bundles published by Lingcheng Technology.',
    zh: '灵城科技发布的 DSH 插件。',
  },
  plugins: [
    {
      name: manifest.name,
      title: { en: en.title, zh: zh.title },
      description: { en: en.description, zh: zh.description },
      icon: 'icons/provider-usage.svg',
      author: 'daishengli',
      homepage: repoUrl,
      repository: { url: repoUrl },
      versions: [
        {
          version: manifest.version,
          publishTimestamp: committedAt,
          source: { type: 'git', url: repoUrl, commit },
          ...(manifest.engines?.dsh === undefined ? {} : { engines: { dsh: manifest.engines.dsh } }),
        },
      ],
    },
  ],
}

// Self-check against the index rules most likely to break silently.
const problems = []
if (index.format !== 1) problems.push('format must be 1')
if (typeof index.title?.en !== 'string') problems.push('title.en is required')
if (!/^[a-z0-9@][a-z0-9._/-]*$/.test(index.plugins[0].name)) problems.push('plugin name looks invalid')
for (const version of index.plugins[0].versions) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version.version)) problems.push(`version ${version.version} is not SemVer`)
  if (!Number.isInteger(version.publishTimestamp) || version.publishTimestamp <= 0) problems.push('publishTimestamp must be Unix seconds')
  if (version.source.type !== 'git') problems.push('source.type must be git')
  if (!/^https:\/\//.test(version.source.url)) problems.push('source.url must be https')
  if (!/^[0-9a-f]{40}$/.test(version.source.commit)) problems.push('source.commit must be a 40-hex sha')
}
if (problems.length > 0) throw new Error(`index self-check failed:\n- ${problems.join('\n- ')}`)

mkdirSync(join(outDir, 'icons'), { recursive: true })
writeFileSync(outFile, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
copyFileSync(join(root, 'icon.svg'), join(outDir, 'icons', 'provider-usage.svg'))

console.log(`wrote ${outFile}`)
console.log(`  ${manifest.name} ${manifest.version} @ ${commit.slice(0, 12)}`)
