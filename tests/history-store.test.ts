import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { HistoryStore } from '../src/main/services/history-store'

const directories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qrtool-history-'))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('HistoryStore', () => {
  it('keeps newest records first and enforces the limit', async () => {
    const directory = await temporaryDirectory()
    const store = new HistoryStore(directory, 2)
    await store.load()
    await store.add('generate', 'first')
    await store.add('generate', 'second')
    await store.add('rebuild', 'third', 'C:\\out\\third.png')

    expect(store.get().map((record) => record.content)).toEqual(['third', 'second'])
    expect(store.get()[0]?.type).toBe('rebuild')
  })

  it('updates the saved path and persists records', async () => {
    const directory = await temporaryDirectory()
    const store = new HistoryStore(directory, 10)
    await store.load()
    const record = await store.add('generate', 'hello')
    await store.updateSavedPath(record.id, 'C:\\out\\hello.png')
    await store.save()

    const reloaded = new HistoryStore(directory, 10)
    await reloaded.load()
    expect(reloaded.get()[0]?.savedPath).toBe('C:\\out\\hello.png')
  })

  it('clears all records', async () => {
    const directory = await temporaryDirectory()
    const store = new HistoryStore(directory, 10)
    await store.load()
    await store.add('generate', 'hello')
    await store.clear()
    expect(store.get()).toEqual([])
  })
})

