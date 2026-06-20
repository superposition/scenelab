'use strict'

function createUnavailableLiveAdapter(reason) {
  return {
    async status() {
      return {
        liveSetReachable: false,
        trackCount: 0,
        sceneCount: 0,
        reason
      }
    },

    async inspectSet() {
      const error = new Error(reason || 'Live set is unreachable.')
      error.code = 'live_set_unreachable'
      throw error
    }
  }
}

function createStaticLiveAdapter(snapshot) {
  const set = normalizeSetSnapshot(snapshot || {})

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
    }
  }
}

function createFailingLiveAdapter(code, message) {
  return {
    async status() {
      const error = new Error(message)
      error.code = code
      throw error
    },

    async inspectSet() {
      const error = new Error(message)
      error.code = code
      throw error
    }
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
  const tracks = Array.isArray(snapshot.tracks)
    ? snapshot.tracks.map((track, index) => ({
        index,
        id: track.id ?? null,
        name: track.name || `Track ${index + 1}`,
        type: track.type || null,
        clipSlots: Array.isArray(track.clipSlots)
          ? track.clipSlots.map((slot, slotIndex) => ({
              sceneIndex: slotIndex,
              hasClip: Boolean(slot.hasClip),
              clipId: slot.clipId ?? null
            }))
          : []
      }))
    : []

  const scenes = Array.isArray(snapshot.scenes)
    ? snapshot.scenes.map((scene, index) => ({
        index,
        id: scene.id ?? null,
        name: scene.name || `Scene ${index + 1}`
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

