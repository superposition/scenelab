import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { scanLibrary } from '../dist/library.js'

const fixtureLibrary = fileURLToPath(new URL('fixtures/ableton-user-library/', import.meta.url))

test('scanLibrary returns a stable inventory for a fixture library', async () => {
  const result = await scanLibrary({ libraryPath: fixtureLibrary })

  assert.deepEqual(result.warnings, [])
  assert.equal(result.inventory.scanVersion, 1)
  assert.equal(result.inventory.libraryPath, fixtureLibrary.replace(/\/$/, ''))
  assert.equal(result.inventory.exists, true)
  assert.equal(result.inventory.assetCount, 6)
  assert.deepEqual(result.inventory.typeCounts, {
    rack: 1,
    clip: 1,
    sample: 1,
    preset: 1,
    template: 1,
    max_for_live_device: 1
  })

  assert.deepEqual(
    result.inventory.assets.map((asset) => ({
      relativePath: asset.relativePath,
      type: asset.type,
      name: asset.name,
      extension: asset.extension,
      tags: asset.tags
    })),
    [
      {
        relativePath: 'Clips/Verse Groove.alc',
        type: 'clip',
        name: 'Verse Groove',
        extension: '.alc',
        tags: ['clip']
      },
      {
        relativePath: 'Max for Live Devices/Synth Tools/Scene Utility.amxd',
        type: 'max_for_live_device',
        name: 'Scene Utility',
        extension: '.amxd',
        tags: ['max-for-live', 'device', 'synth']
      },
      {
        relativePath: 'Presets/Audio Effects/Wide Chorus.adv',
        type: 'preset',
        name: 'Wide Chorus',
        extension: '.adv',
        tags: ['preset', 'audio-effect']
      },
      {
        relativePath: 'Presets/Instruments/City Keys.adg',
        type: 'rack',
        name: 'City Keys',
        extension: '.adg',
        tags: ['rack', 'keys', 'instrument']
      },
      {
        relativePath: 'Samples/Drums/Kick 01.wav',
        type: 'sample',
        name: 'Kick 01',
        extension: '.wav',
        tags: ['sample', 'audio', 'drums', 'kick']
      },
      {
        relativePath: 'Templates/City Pop Starter.als',
        type: 'template',
        name: 'City Pop Starter',
        extension: '.als',
        tags: ['template']
      }
    ]
  )
})

test('scanLibrary returns a warning for missing folders', async () => {
  const missingLibrary = fileURLToPath(new URL('fixtures/missing-library/', import.meta.url))
  const result = await scanLibrary({ libraryPath: missingLibrary })

  assert.equal(result.inventory.exists, false)
  assert.equal(result.inventory.assetCount, 0)
  assert.deepEqual(result.inventory.assets, [])
  assert.equal(result.warnings.length, 1)
  assert.equal(result.warnings[0].code, 'library_missing')
})
