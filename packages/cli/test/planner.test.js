import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { planArrangement } from '../dist/planner.js'

const snapshotPath = fileURLToPath(new URL('./snapshots/city-pop-6-8-plan-shape.json', import.meta.url))

test('city pop 6/8 arrangement plan matches the proof shape snapshot', async () => {
  const plan = await planArrangement({ templateId: 'city-pop-6-8' })
  const expected = JSON.parse(await readFile(snapshotPath, 'utf8'))

  assert.deepEqual(planShapeSnapshot(plan), expected)
})

function planShapeSnapshot(plan) {
  return {
    planVersion: plan.planVersion,
    templateId: plan.templateId,
    dryRun: plan.dryRun,
    meter: plan.meter,
    tempoBpm: plan.tempoBpm,
    keyCenter: plan.keyCenter,
    sceneOrder: plan.scenes.map(({ id, startBar, bars, energy }) => ({ id, startBar, bars, energy })),
    trackRoles: plan.tracks.map(({ id, role, type, required }) => ({ id, role, type, required })),
    clipCount: plan.clips.length,
    proofClips: [
      clipSnapshot(plan, 'clip-intro-drums'),
      clipSnapshot(plan, 'clip-intro-bass'),
      clipSnapshot(plan, 'clip-intro-keys'),
      clipSnapshot(plan, 'clip-chorus-synth-lead'),
      clipSnapshot(plan, 'clip-outro-guitar')
    ],
    automation: plan.automation.map(({ id, target, sections }) => ({ id, target, sections })),
    warningCount: plan.warnings.length
  }
}

function clipSnapshot(plan, id) {
  const clip = plan.clips.find((candidate) => candidate.id === id)
  assert.ok(clip, `Expected clip ${id}`)

  return {
    id: clip.id,
    trackId: clip.trackId,
    sceneId: clip.sceneId,
    lengthBars: clip.lengthBars,
    lengthBeats: clip.lengthBeats,
    loopLengthBars: clip.loopLengthBars,
    noteCount: clip.notes.length,
    firstNotes: clip.notes.slice(0, 4)
  }
}
