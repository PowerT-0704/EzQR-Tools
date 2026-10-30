import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { extractFile, listPackage } from '@electron/asar'
import { ZXING_WASM_SHA256 } from 'zxing-wasm/reader'

const root = path.resolve(import.meta.dirname, '..')
const resources = path.join(root, 'release', 'win-unpacked', 'resources')
const archive = path.join(resources, 'app.asar')
const text = (file) => extractFile(archive, path.normalize(file)).toString('utf8')
const packageJson = JSON.parse(text('package.json'))
const decoder = JSON.parse(text('node_modules/zxing-wasm/package.json'))
assert.equal(packageJson.version, '7.3.0')
assert.equal(decoder.version, '3.1.6')
const wasm = extractFile(archive, path.normalize('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'))
const hash = createHash('sha256').update(wasm).digest('hex')
assert.equal(hash, ZXING_WASM_SHA256)
assert.match(text('node_modules/zxing-wasm/LICENSE'), /MIT License/)
const files = listPackage(archive)
assert.ok(!files.some((file) => /[\\/]node_modules[\\/]jsqr[\\/]/.test(file)))
assert.ok(!files.some((file) => /^[/\\]tests[/\\]/.test(file)))
for (const name of ['zxing-wasm-MIT.txt', 'ZXing-CPP-Apache-2.0.txt',
  'ZXingWasm-wrapper-Apache-2.0.txt', 'Zint-BSD-3-Clause.txt']) {
  assert.deepEqual(await readFile(path.join(resources, 'resources', 'licenses', name)),
    await readFile(path.join(root, 'resources', 'licenses', name)))
}
const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], {
  input: text('out/main/index.js'), encoding: 'utf8'
})
assert.equal(syntax.status, 0, syntax.stderr)
console.log(JSON.stringify({ appVersion: packageJson.version, decoderVersion: decoder.version,
  readerWasmBytes: wasm.length, readerWasmSha256: hash,
  licenses: 'verified', mainSyntax: 'valid', testDecoderIncluded: false }, null, 2))
