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
    action: 'create_clip',
    dryRun: true,
    params: {}
  })

  assert.equal(response.ok, false)
  assert.equal(response.error.code, 'unsupported_operation')
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
