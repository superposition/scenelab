import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { loadTemplateRegistry } from '../dist/templates.js'

const templatesDir = fileURLToPath(new URL('../../../templates', import.meta.url))

test('loads v0 seed arrangement templates', async () => {
  const registry = await loadTemplateRegistry(templatesDir)

  assert.equal(registry.templates.length, 5)
  assert.deepEqual(
    registry.templates.map((template) => template.genreFamily).sort(),
    ['city-pop', 'drum-and-bass', 'jazz', 'modern-pop', 'rock']
  )

  const cityPop = registry.byId.get('city-pop-6-8')
  assert.ok(cityPop)
  assert.equal(cityPop.meter.numerator, 6)
  assert.equal(cityPop.meter.denominator, 8)
  assert.equal(cityPop.tempoRange.defaultBpm, 96)
  assert.ok(cityPop.harmony.language.includes('secondary dominants'))
  assert.ok(cityPop.instrumentation.tracks.some((track) => track.role === 'synth-lead'))
})

test('invalid templates fail with useful file and schema path details', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scenelab-template-invalid-'))
  const filePath = path.join(dir, 'bad-template.json')

  await writeFile(filePath, JSON.stringify({
    schemaVersion: 1,
    id: 'bad-template',
    type: 'arrangement',
    name: 'Bad Template'
  }))

  await assert.rejects(
    () => loadTemplateRegistry(dir),
    (error) => {
      assert.equal(error.name, 'TemplateRegistryError')
      assert.match(error.message, /Template validation failed/)
      assert.equal(error.details.filePath, filePath)
      assert.ok(error.details.issues.some((issue) => issue.path === 'genreFamily'))
      assert.ok(error.details.issues.some((issue) => issue.path === 'meter'))
      return true
    }
  )
})

test('duplicate template ids fail before registry creation succeeds', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scenelab-template-duplicate-'))
  const seed = JSON.parse(await readFile(path.join(templatesDir, 'arrangements', 'city-pop-6-8.json'), 'utf8'))

  await writeFile(path.join(dir, 'first.json'), JSON.stringify(seed))
  await writeFile(path.join(dir, 'second.json'), JSON.stringify({
    ...seed,
    name: 'Duplicate City Pop'
  }))

  await assert.rejects(
    () => loadTemplateRegistry(dir),
    (error) => {
      assert.equal(error.name, 'TemplateRegistryError')
      assert.match(error.message, /Duplicate template id "city-pop-6-8"/)
      assert.equal(error.details.id, 'city-pop-6-8')
      return true
    }
  )
})
