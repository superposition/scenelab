'use strict'

function createUnavailableLiveAdapter(reason) {
  const unavailable = async () => {
    const error = new Error(reason || 'Live set is unreachable.')
    error.code = 'live_set_unreachable'
    throw error
  }

  return {
    async status() {
      return {
        liveSetReachable: false,
        trackCount: 0,
        sceneCount: 0,
        reason
      }
    },

    inspectSet: unavailable,
    createScene: unavailable,
    createMidiTrack: unavailable,
    createMidiClip: unavailable,
    setClipNotes: unavailable,
    setClipName: unavailable
  }
}

function createStaticLiveAdapter(snapshot) {
  const set = normalizeSetSnapshot(snapshot || {})
  let nextId = findNextId(set)

  return {
    async status() {
      return {
        liveSetReachable: true,
        trackCount: set.tracks.length,
        sceneCount: set.scenes.length
      }
    },

    async inspectSet() {
      return set
    },

    async createScene(params = {}) {
      const index = clampInsertIndex(params.index, set.scenes.length)
      const scene = {
        index,
        id: nextId++,
        name: typeof params.name === 'string' && params.name.length > 0 ? params.name : `Scene ${index + 1}`
      }

      set.scenes.splice(index, 0, scene)
      reindex(set.scenes)

      for (const track of set.tracks) {
        track.clipSlots.splice(index, 0, emptyClipSlot(index))
        reindexClipSlots(track.clipSlots)
      }

      return scene
    },

    async createMidiTrack(params = {}) {
      const index = clampInsertIndex(params.index, set.tracks.length)
      const track = {
        index,
        id: nextId++,
        name: typeof params.name === 'string' && params.name.length > 0 ? params.name : `MIDI ${index + 1}`,
        type: 'midi',
        clipSlots: set.scenes.map((_, sceneIndex) => emptyClipSlot(sceneIndex))
      }

      set.tracks.splice(index, 0, track)
      reindex(set.tracks)

      return track
    },

    async createMidiClip(params = {}) {
      const track = getTrack(set, params.trackIndex)
      const slot = getClipSlot(track, params.sceneIndex)

      if (slot.hasClip) {
        const error = new Error(`Clip slot already contains a clip at track ${params.trackIndex}, scene ${params.sceneIndex}.`)
        error.code = 'clip_slot_occupied'
        throw error
      }

      const clip = {
        id: nextId++,
        name: typeof params.name === 'string' && params.name.length > 0 ? params.name : `Clip ${params.sceneIndex + 1}`,
        lengthBeats: getPositiveNumber(params.lengthBeats ?? params.length, 4),
        notes: []
      }

      slot.hasClip = true
      slot.clipId = clip.id
      slot.clip = clip
      return clip
    },

    async setClipNotes(params = {}) {
      const slot = getClipSlot(getTrack(set, params.trackIndex), params.sceneIndex)
      const clip = getClipFromSlot(slot, params)
      clip.notes = normalizeNotes(params.notes)
      return clip
    },

    async setClipName(params = {}) {
      const slot = getClipSlot(getTrack(set, params.trackIndex), params.sceneIndex)
      const clip = getClipFromSlot(slot, params)

      if (typeof params.name !== 'string' || params.name.length === 0) {
        const error = new Error('Clip name is required.')
        error.code = 'invalid_bridge_request'
        throw error
      }

      clip.name = params.name
      return clip
    }
  }
}

function createFailingLiveAdapter(code, message) {
  const fail = async () => {
    const error = new Error(message)
    error.code = code
    throw error
  }

  return {
    status: fail,
    inspectSet: fail,
    createScene: fail,
    createMidiTrack: fail,
    createMidiClip: fail,
    setClipNotes: fail,
    setClipName: fail
  }
}

function createMaxApiLiveAdapter(maxApi, options = {}) {
  const pending = new Map()
  const timeoutMs = Number(options.timeoutMs || 5000)

  maxApi.addHandler('scenelab_live_response', (payload) => {
    const response = parseMaxPayload(payload)

    if (!response || typeof response.bridgeRequestId !== 'string') {
      return
    }

    const waiter = pending.get(response.bridgeRequestId)

    if (!waiter) {
      return
    }

    pending.delete(response.bridgeRequestId)
    clearTimeout(waiter.timeout)

    if (response.ok === false) {
      const error = new Error(response.error?.message || 'Live API operation failed.')
      error.code = response.error?.code || 'live_api_error'
      error.details = response.error?.details
      waiter.reject(error)
      return
    }

    waiter.resolve(response.data || {})
  })

  return {
    status() {
      return sendMaxRequest(maxApi, pending, timeoutMs, 'status', {})
    },

    inspectSet() {
      return sendMaxRequest(maxApi, pending, timeoutMs, 'inspect_set', {})
    },

    createScene(params) {
      return sendMaxRequest(maxApi, pending, timeoutMs, 'create_scene', params)
    },

    createMidiTrack(params) {
      return sendMaxRequest(maxApi, pending, timeoutMs, 'create_midi_track', params)
    },

    createMidiClip(params) {
      return sendMaxRequest(maxApi, pending, timeoutMs, 'create_midi_clip', params)
    },

    setClipNotes(params) {
      return sendMaxRequest(maxApi, pending, timeoutMs, 'set_clip_notes', params)
    },

    setClipName(params) {
      return sendMaxRequest(maxApi, pending, timeoutMs, 'set_clip_name', params)
    }
  }
}

function sendMaxRequest(maxApi, pending, timeoutMs, action, params) {
  const bridgeRequestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(bridgeRequestId)
      const error = new Error(`Timed out waiting for Max Live API response for ${action}.`)
      error.code = 'bridge_request_timeout'
      reject(error)
    }, timeoutMs)

    pending.set(bridgeRequestId, {
      resolve,
      reject,
      timeout
    })

    maxApi.outlet({
      selector: 'scenelab_live_request',
      bridgeRequestId,
      action,
      params
    })
  })
}

function parseMaxPayload(payload) {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch (_error) {
      return null
    }
  }

  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    return payload
  }

  return null
}

function normalizeSetSnapshot(snapshot) {
  const scenes = Array.isArray(snapshot.scenes)
    ? snapshot.scenes.map((scene, index) => ({
        index,
        id: scene.id ?? null,
        name: scene.name || `Scene ${index + 1}`
      }))
    : []

  const tracks = Array.isArray(snapshot.tracks)
    ? snapshot.tracks.map((track, index) => ({
        index,
        id: track.id ?? null,
        name: track.name || `Track ${index + 1}`,
        type: track.type || null,
        clipSlots: Array.from({ length: scenes.length }, (_, slotIndex) => {
          const slot = Array.isArray(track.clipSlots) ? track.clipSlots[slotIndex] || {} : {}
          return {
            sceneIndex: slotIndex,
            hasClip: Boolean(slot.hasClip),
            clipId: slot.clipId ?? slot.clip?.id ?? null,
            clip: slot.clip
              ? {
                  id: slot.clip.id ?? slot.clipId ?? null,
                  name: slot.clip.name || `Clip ${slotIndex + 1}`,
                  lengthBeats: getPositiveNumber(slot.clip.lengthBeats, 4),
                  notes: normalizeNotes(slot.clip.notes || [])
                }
              : null
          }
        })
      }))
    : []

  return {
    tracks,
    scenes
  }
}

module.exports = {
  createUnavailableLiveAdapter,
  createStaticLiveAdapter,
  createFailingLiveAdapter,
  createMaxApiLiveAdapter,
  normalizeSetSnapshot
}

function findNextId(set) {
  const ids = []

  for (const scene of set.scenes) {
    if (typeof scene.id === 'number') ids.push(scene.id)
  }

  for (const track of set.tracks) {
    if (typeof track.id === 'number') ids.push(track.id)

    for (const slot of track.clipSlots) {
      if (typeof slot.clipId === 'number') ids.push(slot.clipId)
      if (slot.clip && typeof slot.clip.id === 'number') ids.push(slot.clip.id)
    }
  }

  return ids.length > 0 ? Math.max(...ids) + 1 : 1
}

function clampInsertIndex(index, max) {
  if (!Number.isInteger(index)) {
    return max
  }

  return Math.max(0, Math.min(index, max))
}

function reindex(items) {
  items.forEach((item, index) => {
    item.index = index
  })
}

function reindexClipSlots(slots) {
  slots.forEach((slot, index) => {
    slot.sceneIndex = index
  })
}

function emptyClipSlot(sceneIndex) {
  return {
    sceneIndex,
    hasClip: false,
    clipId: null,
    clip: null
  }
}

function getTrack(set, trackIndex) {
  if (!Number.isInteger(trackIndex) || trackIndex < 0 || trackIndex >= set.tracks.length) {
    const error = new Error(`Track index does not exist: ${trackIndex}`)
    error.code = 'live_path_not_found'
    throw error
  }

  return set.tracks[trackIndex]
}

function getClipSlot(track, sceneIndex) {
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0 || sceneIndex >= track.clipSlots.length) {
    const error = new Error(`Scene index does not exist: ${sceneIndex}`)
    error.code = 'live_path_not_found'
    throw error
  }

  return track.clipSlots[sceneIndex]
}

function getClipFromSlot(slot, params) {
  if (!slot.hasClip || !slot.clip) {
    const error = new Error(`No clip exists at track ${params.trackIndex}, scene ${params.sceneIndex}.`)
    error.code = 'live_path_not_found'
    throw error
  }

  return slot.clip
}

function getPositiveNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function normalizeNotes(notes) {
  if (!Array.isArray(notes)) {
    return []
  }

  return notes.map((note) => {
    const input = isRecord(note) ? note : {}

    return {
      pitch: getMidiPitch(input.pitch),
      startBeat: getNonNegativeNumber(input.startBeat ?? input.start, 0),
      durationBeats: getPositiveNumber(input.durationBeats ?? input.duration, 0.25),
      velocity: getVelocity(input.velocity),
      muted: Boolean(input.muted)
    }
  })
}

function getMidiPitch(value) {
  if (Number.isInteger(value)) {
    return Math.max(0, Math.min(value, 127))
  }

  return 60
}

function getNonNegativeNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

function getVelocity(value) {
  if (Number.isInteger(value)) {
    return Math.max(1, Math.min(value, 127))
  }

  return 100
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
