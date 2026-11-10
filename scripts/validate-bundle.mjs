/**
 * Static validation for the Temporary Project bundle.
 *
 * Checks the manifest shape, declared exports/files, locale metadata, the
 * icon's format and size, and the Host patch row. It does not install or
 * activate anything.
 */
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, '..')
const manifest = JSON.parse(readFileSync(join(bundle, 'package.json'), 'utf8'))

assert.equal(manifest.name, '@local/dsh-temporary-project')
assert.equal(manifest.private, true)
assert.equal(manifest.type, 'module')
assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml')
assert.equal(manifest.dsh?.client?.platform, 'web')
assert.ok(Array.isArray(manifest.dsh?.client?.inject))
assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-conversation'))
assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-workspace'))
assert.equal(manifest.exports?.['.'], './index.js')
assert.equal(manifest.exports?.['./client'], './client.js')
assert.equal(manifest.exports?.['./icon'], './icon.svg')
assert.equal(manifest.exports?.['./locale/*.json'], './locale/*.json')

for (const file of ['index.js', 'route.js', 'client.js', 'cordis.patch.yml', 'locale/en.json', 'locale/zh.json', 'icon.svg', 'README.md', 'LICENSE']) {
  assert.ok(statSync(join(bundle, file)).size > 0, `${file} is missing or empty`)
}
assert.ok(manifest.files.includes('index.js'))
assert.ok(manifest.files.includes('route.js'))
assert.ok(manifest.files.includes('client.js'))
assert.ok(manifest.files.includes('cordis.patch.yml'))
assert.ok(manifest.files.includes('locale/*.json'))
assert.ok(manifest.files.includes('icon.svg'))
assert.ok(manifest.files.includes('README.md'))
assert.ok(manifest.files.includes('LICENSE'))

for (const locale of ['en', 'zh']) {
  const dict = JSON.parse(readFileSync(join(bundle, 'locale', `${locale}.json`), 'utf8'))
  assert.equal(typeof dict.meta?.title, 'string')
  assert.equal(typeof dict.meta?.description, 'string')
  assert.ok(dict.meta.title.length > 0)
  assert.ok(dict.meta.description.length > 0)
}

const iconBytes = statSync(join(bundle, 'icon.svg')).size
assert.ok(iconBytes < 256 * 1024, `icon.svg is ${iconBytes} bytes`)
const icon = readFileSync(join(bundle, 'icon.svg'), 'utf8')
assert.ok(icon.includes('<svg'))
assert.ok(icon.trimEnd().endsWith('</svg>'))

const patch = readFileSync(join(bundle, 'cordis.patch.yml'), 'utf8')
assert.ok(patch.includes("- id: temporary-project"))
assert.ok(patch.includes("name: './route.js'"))

console.log('validate-bundle.mjs: bundle manifest and resources are valid')
