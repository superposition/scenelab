import type { SceneLabTemplate } from './templates.js'
import { TemplateRegistryError, loadTemplateRegistry } from './templates.js'

export type ArrangementPlanNote = {
  pitch: number
  startBeat: number
  durationBeats: number
  velocity: number
  role: string
}

export type ArrangementPlanClip = {
  id: string
  trackId: string
  sceneId: string
  name: string
  lengthBars: number
  lengthBeats: number
  loopLengthBars: number
  beatUnit: string
  intent: string
  notes: ArrangementPlanNote[]
}

export type ArrangementPlan = {
  planVersion: 1
  templateId: string
  templateName: string
  dryRun: true
  meter: SceneLabTemplate['meter']
  tempoBpm: number
  keyCenter: string
  summary: string
  scenes: Array<{
    id: string
    name: string
    index: number
    startBar: number
    bars: number
    energy: number
    roles: string[]
  }>
  tracks: Array<{
    id: string
    role: string
    name: string
    type: string
    required: boolean
    sound?: string
    order: number
  }>
  clips: ArrangementPlanClip[]
  automation: Array<{
    id: string
    target: string
    gesture: string
    sections: string[]
  }>
  assets: SceneLabTemplate['assets']
  mix: SceneLabTemplate['mix']
  warnings: string[]
}

export type PlanArrangementOptions = {
  templateId?: string
}

type CityPopSectionPhrase = {
  chords: number[][]
  bass: number[]
  lead: number[]
}

const cityPopPhrases: Record<string, CityPopSectionPhrase> = {
  intro: {
    chords: [
      [57, 61, 64, 68],
      [54, 57, 61, 64],
      [59, 62, 66, 69],
      [52, 56, 62, 66]
    ],
    bass: [45, 42, 47, 40],
    lead: [76, 78, 80, 83]
  },
  'verse-a': {
    chords: [
      [57, 61, 64, 68],
      [49, 54, 57, 61],
      [50, 53, 57, 60],
      [52, 56, 59, 62]
    ],
    bass: [45, 44, 42, 40],
    lead: [69, 71, 73, 76]
  },
  'pre-chorus': {
    chords: [
      [50, 53, 57, 60],
      [52, 56, 59, 62],
      [54, 57, 61, 64],
      [56, 60, 64, 68]
    ],
    bass: [38, 40, 42, 44],
    lead: [73, 76, 78, 80]
  },
  chorus: {
    chords: [
      [57, 61, 64, 68],
      [52, 56, 59, 62],
      [54, 57, 61, 64],
      [59, 62, 66, 69]
    ],
    bass: [45, 40, 42, 47],
    lead: [80, 83, 85, 88]
  },
  bridge: {
    chords: [
      [53, 57, 60, 64],
      [55, 59, 62, 65],
      [56, 60, 64, 68],
      [52, 56, 59, 62]
    ],
    bass: [41, 43, 44, 40],
    lead: [72, 74, 76, 79]
  },
  outro: {
    chords: [
      [57, 61, 64, 68],
      [59, 62, 66, 69],
      [52, 56, 62, 66],
      [57, 61, 64, 71]
    ],
    bass: [45, 47, 40, 45],
    lead: [83, 85, 88, 90]
  }
}

export async function planArrangement(options: PlanArrangementOptions = {}): Promise<ArrangementPlan> {
  const templateId = options.templateId ?? 'city-pop-6-8'
  const registry = await loadTemplateRegistry()
  const template = registry.byId.get(templateId)

  if (!template) {
    throw new TemplateRegistryError(`Template not found: ${templateId}`, {
      templateId,
      availableTemplateIds: registry.templates.map((candidate) => candidate.id)
    })
  }

  if (template.id !== 'city-pop-6-8') {
    throw new TemplateRegistryError(`Arrangement planner is not implemented for template: ${template.id}`, {
      templateId: template.id,
      implementedTemplateIds: ['city-pop-6-8']
    })
  }

  return planCityPopSixEight(template)
}

function planCityPopSixEight(template: SceneLabTemplate): ArrangementPlan {
  const scenes = buildScenes(template)
  const tracks = template.instrumentation.tracks.map((track, index) => ({
    id: stableId('track', track.role),
    role: track.role,
    name: track.name,
    type: track.type,
    required: track.required,
    ...(track.sound ? { sound: track.sound } : {}),
    order: index
  }))

  return {
    planVersion: 1,
    templateId: template.id,
    templateName: template.name,
    dryRun: true,
    meter: template.meter,
    tempoBpm: template.tempoRange.defaultBpm,
    keyCenter: template.harmony.keyCenter,
    summary: 'City pop 6/8 dry-run plan with section scenes, role tracks, MIDI clip phrases, and automation intent.',
    scenes,
    tracks,
    clips: buildClips(template, scenes, tracks),
    automation: template.automation.lanes.map((lane, index) => ({
      id: stableId('automation', `${index + 1}-${lane.target}`),
      target: lane.target,
      gesture: lane.gesture,
      sections: lane.sections
    })),
    assets: template.assets,
    mix: template.mix,
    warnings: [
      ...template.assets.warnings,
      'This is a dry-run plan. Applying it still requires explicit confirmation and a running SceneLab bridge.',
      'Audio roles are represented as named placeholder clips until audio placement is implemented.'
    ]
  }
}

function buildScenes(template: SceneLabTemplate): ArrangementPlan['scenes'] {
  let startBar = 1

  return template.arrangementRoles.sections.map((section, index) => {
    const scene = {
      id: stableId('scene', section.id),
      name: section.name,
      index,
      startBar,
      bars: section.bars,
      energy: section.energy,
      roles: section.roles
    }
    startBar += section.bars
    return scene
  })
}

function buildClips(
  template: SceneLabTemplate,
  scenes: ArrangementPlan['scenes'],
  tracks: ArrangementPlan['tracks']
): ArrangementPlanClip[] {
  const clips: ArrangementPlanClip[] = []

  for (const scene of scenes) {
    const sectionId = scene.id.replace(/^scene-/, '')

    for (const track of tracks) {
      clips.push({
        id: stableId('clip', `${sectionId}-${track.role}`),
        trackId: track.id,
        sceneId: scene.id,
        name: `${scene.name} - ${track.name}`,
        lengthBars: scene.bars,
        lengthBeats: scene.bars * template.meter.numerator,
        loopLengthBars: track.type === 'audio' ? scene.bars : Math.min(scene.bars, 4),
        beatUnit: 'eighth-note',
        intent: clipIntent(track.role, sectionId),
        notes: track.type === 'midi' ? notesForRole(track.role, sectionId) : []
      })
    }
  }

  return clips
}

function notesForRole(role: string, sectionId: string): ArrangementPlanNote[] {
  const phrase = cityPopPhrases[sectionId] ?? cityPopPhrases.intro

  switch (role) {
    case 'drums':
      return drumPhrase()

    case 'bass':
      return bassPhrase(phrase.bass)

    case 'keys':
      return chordPhrase(phrase.chords, 'chord-tone', 76)

    case 'brass':
      return stabPhrase(phrase.chords)

    case 'strings':
      return chordPhrase(phrase.chords.slice(0, 2), 'sustain', 62, 6)

    case 'synth-lead':
      return leadPhrase(phrase.lead, sectionId)

    default:
      return []
  }
}

function drumPhrase(): ArrangementPlanNote[] {
  const notes: ArrangementPlanNote[] = []

  for (let bar = 0; bar < 2; bar += 1) {
    const offset = bar * 6
    notes.push(note(36, offset, 0.5, 106, 'kick'))
    notes.push(note(36, offset + 3, 0.5, 96, 'kick'))
    notes.push(note(38, offset + 3, 0.75, 104, 'snare'))

    for (let step = 0; step < 6; step += 1) {
      notes.push(note(42, offset + step, 0.25, step % 3 === 0 ? 72 : 58, 'hat'))
    }
  }

  notes.push(note(38, 11.5, 0.25, 72, 'ghost-snare'))
  return notes
}

function bassPhrase(pitches: number[]): ArrangementPlanNote[] {
  return pitches.flatMap((pitch, index) => {
    const start = index * 3
    return [
      note(pitch, start, 1.5, 96, 'root-motion'),
      note(pitch + 12, start + 2.5, 0.5, 78, 'pickup')
    ]
  })
}

function chordPhrase(chords: number[][], role: string, velocity: number, durationBeats = 2.75): ArrangementPlanNote[] {
  return chords.flatMap((chord, index) => chord.map((pitch) => note(pitch, index * 3, durationBeats, velocity, role)))
}

function stabPhrase(chords: number[][]): ArrangementPlanNote[] {
  return chords.flatMap((chord, index) => chord.slice(1).map((pitch) => note(pitch + 12, index * 3 + 2.5, 0.5, 92, 'brass-stab')))
}

function leadPhrase(pitches: number[], sectionId: string): ArrangementPlanNote[] {
  const activeSections = new Set(['intro', 'pre-chorus', 'chorus', 'outro'])

  if (!activeSections.has(sectionId)) {
    return []
  }

  return pitches.map((pitch, index) => note(pitch, index * 1.5, 1, 88, 'lead-hook'))
}

function note(pitch: number, startBeat: number, durationBeats: number, velocity: number, role: string): ArrangementPlanNote {
  return {
    pitch,
    startBeat,
    durationBeats,
    velocity,
    role
  }
}

function clipIntent(role: string, sectionId: string): string {
  const section = sectionId.replaceAll('-', ' ')

  switch (role) {
    case 'drums':
      return `6/8 drum placeholder for ${section}: kick, snare lift, hats, and transition ghost note.`
    case 'bass':
      return `Bass motion for ${section}: roots, inversions, and chromatic pickup intent.`
    case 'keys':
      return `Polyphonic electric piano voicings for ${section}.`
    case 'guitar':
      return `Clean guitar audio placeholder for pushed upstrokes in ${section}.`
    case 'brass':
      return `Brass answer stabs for ${section}.`
    case 'strings':
      return `Sustained string pad support for ${section}.`
    case 'synth-lead':
      return `Serum lead hook or response phrase for ${section}.`
    default:
      return `Arrangement placeholder for ${role} in ${section}.`
  }
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}
