const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { extractAllEntryPoints } = require('./extractEntryPoints')

test('generates Luau module paths and preserves exported generic defaults', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'npmluau-links-'))
  try {
    const modules = path.join(temporary, 'node_modules')
    const cases = [
      ['@scope/types', 'src/init.luau', '../../@scope/types/src'],
      ['root', 'init.lua', '../root'],
      ['ordinary', 'src/main.luau', '../ordinary/src/main'],
      ['legacy', 'main.lua', '../legacy/main'],
      ['data', 'settings.json', '../data/settings.json'],
    ]
    for (const [name, main] of cases) {
      const directory = path.join(modules, name)
      await fs.mkdir(path.dirname(path.join(directory, main)), {
        recursive: true,
      })
      await fs.writeFile(
        path.join(directory, 'package.json'),
        JSON.stringify({ name, main })
      )
      await fs.writeFile(
        path.join(directory, main),
        main.endsWith('.json')
          ? '{}'
          : 'export type Format = "email" | "uri"\nexport type Text<F = Format> = { format: F }\nreturn {}\n'
      )
    }
    const entries = await extractAllEntryPoints(modules)
    assert.equal(entries.length, cases.length)
    for (const [name, , requirePath] of cases) {
      const entry = entries.find((item) => item.name === name)
      const quote = name === 'data' ? '"' : "'"
      assert.ok(
        entry.entryPoint.includes(`require(${quote}${requirePath}${quote})`),
        entry.entryPoint
      )
      if (name !== 'data') {
        assert.ok(
          entry.entryPoint.includes('export type Text<F = Format>'),
          entry.entryPoint
        )
        assert.ok(!entry.entryPoint.includes(`${requirePath}/init.luau`))
      }
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true })
  }
})
