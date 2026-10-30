import { expect, it } from 'vitest'
import { MediaStore } from '../src/main/services/media-store'

const token = (url: string): string => new URL(url).pathname.slice(1)

it('retains current previews while evicting unused media within the existing limit', async () => {
  const store = new MediaStore()
  const generated = store.addBuffer(Buffer.from('generated'), 'image/png', 'generated')
  const rebuilt = store.addBuffer(Buffer.from('rebuilt'), 'image/png', 'rebuilt')
  const source = store.addFile('source.png', 'decode-source')
  const disposable: string[] = []
  for (let index = 0; index < 80; index += 1) disposable.push(store.addBuffer(Buffer.from(String(index))))
  expect(await (await store.resolve(token(generated)))?.text()).toBe('generated')
  expect(await (await store.resolve(token(rebuilt)))?.text()).toBe('rebuilt')
  expect(store.get(token(source))?.filePath).toBe('source.png')
  expect(disposable.filter((url) => store.get(token(url)))).toHaveLength(37)
  const replacement = store.addBuffer(Buffer.from('new'), 'image/png', 'generated')
  for (let index = 0; index < 40; index += 1) store.addBuffer(Buffer.from('temporary'))
  expect(store.get(token(generated))).toBeNull()
  expect(await (await store.resolve(token(replacement)))?.text()).toBe('new')
  expect(store.get(token(rebuilt))).not.toBeNull()
})
