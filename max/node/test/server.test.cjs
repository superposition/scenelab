'use strict'

const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const path = require('node:path')
const { test } = require('node:test')
const { createBridgeServer, listenBridgeServer } = require('../src/server.cjs')
const { createFailingLiveAdapter, createStaticLiveAdapter, createUnavailableLiveAdapter } = require('../src/live-adapter.cjs')

const cliPath = path.resolve(__dirname, '../../../packages/cli/dist/index.js')

test('status reports bridge and empty Live set availability', async (t) => {
  const bridge = await startBridge(createStaticLiveAdapter({ tracks: [], scenes: [] }))
  t.after(() => bridge.close())

  const response = await postRequest(bridge.url, {
    id: 'status-empty',
    action: 'status',
    dryRun: true,
    params: {}
  })

  assert.equal(response.ok, true)
  assert.equal(response.id, 'status-empty')
  assert.equal(response.data.bridge.host, '127.0.0.1')
  assert.equal(response.data.bridge.port, bridge.port)
  assert.equal(response.data.live.liveSetReachable, true)
  assert.equal(response.data.live.trackCount, 0)
  assert.equal(response.data.live.sceneCount, 0)
})

test('inspect_set returns tracks scenes and clip slot occupancy', async (t) => {
  const bridge = await startBridge(
    createStaticLiveAdapter({
      tracks: [
        {
          id: 11,
          name: 'Drums',
          type: 'midi',
          clipSlots: [{ hasClip: true, clipId: 101 }, { hasClip: false }]
        },
        {
          id: 12,
          name: 'Bass',
          type: 'midi',
          clipSlots: [{ hasClip: false }, { hasClip: true, clipId: 202 }]
        }
      ],
      scenes: [
        { id: 21, name: 'Intro' },
        { id: 22, name: 'A' }
      ]
    })
  )
  t.after(() => bridge.close())

  const response = await postRequest(bridge.url, {
    id: 'inspect-non-empty',
    action: 'inspect_set',
    dryRun: true,
    params: {}
  })

  assert.equal(response.ok, true)
  assert.equal(response.data.set.tracks.length, 2)
  assert.equal(response.data.set.scenes.length, 2)
  assert.equal(response.data.set.tracks[0].name, 'Drums')
  assert.equal(response.data.set.tracks[0].clipSlots[0].hasClip, true)
  assert.equal(response.data.set.tracks[1].clipSlots[1].clipId, 202)
})

test('CLI status succeeds against the bridge server', async (t) => {
  const bridge = await startBridge(createStaticLiveAdapter({ tracks: [{ name: 'Keys' }], scenes: [{ name: 'Intro' }] }))
  t.after(() => bridge.close())

  const result = await runCli(
    {
      id: 'cli-status',
      action: 'status',
      dryRun: true,
      params: {}
    },
    bridge.url
  )

  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.json.ok, true)
  assert.equal(result.json.data.live.trackCount, 1)
  assert.equal(result.json.data.live.sceneCount, 1)
})

test('CLI inspect_set succeeds against the bridge server', async (t) => {
  const bridge = await startBridge(createStaticLiveAdapter({ tracks: [{ name: 'Lead', clipSlots: [{ hasClip: true, clipId: 77 }] }], scenes: [{ name: 'Hook' }] }))
  t.after(() => bridge.close())

  const result = await runCli(
    {
      id: 'cli-inspect',
      action: 'inspect_set',
      dryRun: true,
      params: {}
    },
    bridge.url
  )

  assert.equal(result.status, 0)
  assert.equal(result.json.ok, true)
  assert.equal(result.json.data.set.tracks[0].name, 'Lead')
  assert.equal(result.json.data.set.tracks[0].clipSlots[0].hasClip, true)
})

test('Live adapter failures return structured SceneLab errors', async (t) => {
  const bridge = await startBridge(createFailingLiveAdapter('live_api_error', 'Fake Live API failure'))
  t.after(() => bridge.close())

  const response = await postRequest(bridge.url, {
    id: 'broken-live',
    action: 'inspect_set',
    dryRun: true,
    params: {}
  })

  assert.equal(response.ok, false)
  assert.equal(response.id, 'broken-live')
  assert.equal(response.error.code, 'live_api_error')
  assert.equal(response.error.message, 'Fake Live API failure')
})

test('unavailable Live adapter reports status but rejects inspection', async (t) => {
  const bridge = await startBridge(createUnavailableLiveAdapter('not in Max'))
  t.after(() => bridge.close())

  const status = await postRequest(bridge.url, {
    id: 'unavailable-status',
    action: 'status',
    dryRun: true,
    params: {}
  })
  const inspect = await postRequest(bridge.url, {
    id: 'unavailable-inspect',
    action: 'inspect_set',
    dryRun: true,
    params: {}
  })

  assert.equal(status.ok, true)
  assert.equal(status.data.live.liveSetReachable, false)
  assert.equal(inspect.ok, false)
  assert.equal(inspect.error.code, 'live_set_unreachable')
})

test('unsupported actions return structured errors', async (t) => {
  const bridge = await startBridge(createStaticLiveAdapter({}))
  t.after(() => bridge.close())

  const response = await postRequest(bridge.url, {
    id: 'unsupported',
    action: 'load_rack',
    dryRun: true,
    params: {}
  })

  assert.equal(response.ok, false)
  assert.equal(response.error.code, 'unsupported_operation')
})

test('dry-run write requests do not mutate the Live set', async (t) => {
  const bridge = await startBridge(createStaticLiveAdapter({ tracks: [], scenes: [] }))
  t.after(() => bridge.close())

  const dryRun = await postRequest(bridge.url, {
    id: 'dry-run-scene',
    action: 'create_scene',
    dryRun: true,
    params: {
      name: 'Intro'
    }
  })
  const inspect = await postRequest(bridge.url, {
    id: 'after-dry-run',
    action: 'inspect_set',
    dryRun: true,
    params: {}
  })

  assert.equal(dryRun.ok, true)
  assert.equal(dryRun.data.status, 'dry_run')
  assert.equal(inspect.data.set.scenes.length, 0)
})

test('write requests require apply confirmation even when called directly on bridge', async (t) => {
  const bridge = await startBridge(createStaticLiveAdapter({ tracks: [], scenes: [] }))
  t.after(() => bridge.close())

  const response = await postRequest(bridge.url, {
    id: 'missing-confirm',
    action: 'create_scene',
    dryRun: false,
    params: {
      name: 'Intro'
    }
  })

  assert.equal(response.ok, false)
  assert.equal(response.error.code, 'missing_apply_confirmation')
})

test('confirmed writes create scene track clip name and notes', async (t) => {
  const bridge = await startBridge(createStaticLiveAdapter({ tracks: [], scenes: [] }))
  t.after(() => bridge.close())

  const scene = await applyRequest(bridge.url, {
    id: 'create-scene',
    action: 'create_scene',
    params: {
      name: 'Intro'
    }
  })
  const track = await applyRequest(bridge.url, {
    id: 'create-track',
    action: 'create_midi_track',
    params: {
      name: 'Keys'
    }
  })
  const clip = await applyRequest(bridge.url, {
    id: 'create-clip',
    action: 'create_midi_clip',
    params: {
      trackIndex: 0,
      sceneIndex: 0,
      lengthBeats: 6,
      name: 'Intro Keys'
    }
  })
  const renamed = await applyRequest(bridge.url, {
    id: 'rename-clip',
    action: 'set_clip_name',
    params: {
      trackIndex: 0,
      sceneIndex: 0,
      name: 'Intro Keys 6/8'
    }
  })
  const notes = await applyRequest(bridge.url, {
    id: 'set-notes',
    action: 'set_clip_notes',
    params: {
      trackIndex: 0,
      sceneIndex: 0,
      notes: [
        { pitch: 60, startBeat: 0, durationBeats: 1.5, velocity: 96 },
        { pitch: 64, startBeat: 0, durationBeats: 1.5, velocity: 92 },
        { pitch: 67, startBeat: 0, durationBeats: 1.5, velocity: 90 }
      ]
    }
  })
  const inspect = await postRequest(bridge.url, {
    id: 'inspect-created',
    action: 'inspect_set',
    dryRun: true,
    params: {}
  })

  assert.equal(scene.data.scene.name, 'Intro')
  assert.equal(track.data.track.name, 'Keys')
  assert.equal(clip.data.clip.lengthBeats, 6)
  assert.equal(renamed.data.clip.name, 'Intro Keys 6/8')
  assert.equal(notes.data.clip.notes.length, 3)
  assert.equal(inspect.data.set.scenes.length, 1)
  assert.equal(inspect.data.set.tracks.length, 1)
  assert.equal(inspect.data.set.tracks[0].clipSlots[0].hasClip, true)
  assert.equal(inspect.data.set.tracks[0].clipSlots[0].clip.name, 'Intro Keys 6/8')
})

test('occupied clip slots return structured errors', async (t) => {
  const bridge = await startBridge(
    createStaticLiveAdapter({
      tracks: [{ name: 'Keys' }],
      scenes: [{ name: 'Intro' }]
    })
  )
  t.after(() => bridge.close())

  await applyRequest(bridge.url, {
    id: 'first-clip',
    action: 'create_midi_clip',
    params: {
      trackIndex: 0,
      sceneIndex: 0,
      lengthBeats: 4
    }
  })
  const second = await applyRequest(bridge.url, {
    id: 'second-clip',
    action: 'create_midi_clip',
    params: {
      trackIndex: 0,
      sceneIndex: 0,
      lengthBeats: 4
    }
  })

  assert.equal(second.ok, false)
  assert.equal(second.error.code, 'clip_slot_occupied')
})

test('CLI can apply a confirmed scene creation through the bridge', async (t) => {
  const bridge = await startBridge(createStaticLiveAdapter({ tracks: [], scenes: [] }))
  t.after(() => bridge.close())

  const result = await runCli(
    {
      id: 'cli-create-scene',
      action: 'create_scene',
      dryRun: false,
      confirm: 'apply',
      params: {
        name: 'CLI Intro'
      }
    },
    bridge.url
  )

  assert.equal(result.status, 0)
  assert.equal(result.json.ok, true)
  assert.equal(result.json.data.scene.name, 'CLI Intro')
})

async function startBridge(liveAdapter) {
  const server = createBridgeServer({
    host: '127.0.0.1',
    port: 0,
    liveAdapter,
    requestTimeoutMs: 1000
  })
  await listenBridgeServer(server, '127.0.0.1', 0)
  const address = server.address()
  assert.equal(typeof address, 'object')

  return {
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
        server.closeAllConnections()
      })
  }
}

async function postRequest(url, body) {
  const response = await fetch(`${url}/requests`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  assert.equal(response.status, 200)
  return response.json()
}

function applyRequest(url, body) {
  return postRequest(url, {
    dryRun: false,
    confirm: 'apply',
    ...body
  })
}

function runCli(body, bridgeUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath], {
      env: {
        ...process.env,
        SCENELAB_BRIDGE_URL: bridgeUrl
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (status) => {
      try {
        resolve({
          status,
          stdout,
          stderr,
          json: JSON.parse(stdout)
        })
      } catch (error) {
        reject(error)
      }
    })

    child.stdin.end(JSON.stringify(body))
  })
}
