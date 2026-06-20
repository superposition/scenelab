import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url))
const fixtureLibrary = fileURLToPath(new URL('fixtures/ableton-user-library/', import.meta.url))

function runCli(input, options = {}) {
  const result = spawnSync(process.execPath, [cli], {
    input,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...options.env
    }
  })

  return {
    ...result,
    json: JSON.parse(result.stdout)
  }
}

function runCliAsync(input, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli], {
      env: {
        ...process.env,
        ...options.env
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

    child.stdin.end(input)
  })
}

test('status returns a structured success response', () => {
  const result = runCli(JSON.stringify({ action: 'status' }))

  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.json.ok, true)
  assert.equal(result.json.dryRun, true)
  assert.equal(result.json.summary, 'SceneLab CLI is ready')
  assert.equal(result.json.data.cli, 'ready')
})

test('invalid JSON returns a structured JSON error', () => {
  const result = runCli('{not json')

  assert.equal(result.status, 1)
  assert.equal(result.stderr, '')
  assert.equal(result.json.ok, false)
  assert.equal(result.json.error.code, 'invalid_json')
})

test('invalid action returns a stable schema error', () => {
  const result = runCli(JSON.stringify({ id: 'bad-action', action: 'nope' }))

  assert.equal(result.status, 1)
  assert.equal(result.json.ok, false)
  assert.equal(result.json.id, 'bad-action')
  assert.equal(result.json.error.code, 'invalid_request')
  assert.ok(Array.isArray(result.json.error.details))
})

test('mutating requests require explicit apply confirmation', () => {
  const result = runCli(
    JSON.stringify({
      id: 'apply-without-confirm',
      action: 'apply_plan',
      dryRun: false,
      params: {}
    })
  )

  assert.equal(result.status, 1)
  assert.equal(result.json.ok, false)
  assert.equal(result.json.id, 'apply-without-confirm')
  assert.equal(result.json.error.code, 'invalid_request')
  assert.match(JSON.stringify(result.json.error.details), /confirm/)
})

test('confirmed mutating requests reach placeholder action handler', () => {
  const result = runCli(
    JSON.stringify({
      id: 'apply-confirmed',
      action: 'apply_plan',
      dryRun: false,
      confirm: 'apply',
      params: {}
    })
  )

  assert.equal(result.status, 0)
  assert.equal(result.json.ok, true)
  assert.equal(result.json.id, 'apply-confirmed')
  assert.equal(result.json.dryRun, false)
  assert.equal(result.json.data.status, 'not_implemented')
})

test('plan_arrangement returns a city pop 6/8 dry-run plan', () => {
  const result = runCli(
    JSON.stringify({
      id: 'plan-city-pop',
      action: 'plan_arrangement',
      params: {
        templateId: 'city-pop-6-8'
      }
    })
  )

  assert.equal(result.status, 0)
  assert.equal(result.json.ok, true)
  assert.equal(result.json.summary, 'Planned City Pop 6/8 Proof')
  assert.equal(result.json.data.plan.templateId, 'city-pop-6-8')
  assert.equal(result.json.data.plan.dryRun, true)
  assert.equal(result.json.data.plan.meter.numerator, 6)
  assert.equal(result.json.data.plan.meter.denominator, 8)
  assert.equal(result.json.data.plan.scenes.length, 6)
  assert.equal(result.json.data.plan.tracks.length, 7)
  assert.equal(result.json.data.plan.clips.length, 42)
  assert.ok(result.json.data.plan.clips.some((clip) => clip.id === 'clip-intro-keys' && clip.notes.length >= 4))
  assert.ok(result.json.data.plan.clips.some((clip) => clip.id === 'clip-intro-bass' && clip.notes.some((note) => note.role === 'pickup')))
  assert.ok(result.json.data.plan.clips.some((clip) => clip.id === 'clip-intro-drums' && clip.notes.some((note) => note.role === 'hat')))
  assert.deepEqual(
    result.json.data.plan.automation.map((lane) => lane.target),
    ['synth-lead.cutoff', 'return.delay.send']
  )
})

test('plan_arrangement remains local when a bridge is configured', async (t) => {
  const received = []
  const bridge = await startFakeBridge(async (request, response) => {
    const body = await readJsonRequest(request)
    received.push(body)

    writeJsonResponse(response, 200, {
      ok: true,
      id: body.id,
      dryRun: body.dryRun,
      summary: 'Fake bridge should not handle planning',
      data: {
        bridge: 'fake'
      },
      warnings: []
    })
  })
  t.after(async () => bridge.close())

  const result = await runCliAsync(JSON.stringify({ id: 'local-plan', action: 'plan_arrangement' }), {
    env: {
      SCENELAB_BRIDGE_URL: bridge.url
    }
  })

  assert.equal(result.status, 0)
  assert.equal(result.json.ok, true)
  assert.equal(result.json.summary, 'Planned City Pop 6/8 Proof')
  assert.equal(result.json.data.plan.templateId, 'city-pop-6-8')
  assert.deepEqual(received, [])
})

test('scan_library returns an inventory for a provided library path', () => {
  const result = runCli(
    JSON.stringify({
      id: 'scan-fixture',
      action: 'scan_library',
      params: {
        libraryPath: fixtureLibrary
      }
    })
  )

  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.json.ok, true)
  assert.equal(result.json.summary, 'Scanned Ableton User Library: 6 assets')
  assert.equal(result.json.data.inventory.exists, true)
  assert.equal(result.json.data.inventory.assetCount, 6)
  assert.equal(result.json.data.inventory.typeCounts.rack, 1)
  assert.equal(result.json.data.inventory.typeCounts.max_for_live_device, 1)
  assert.deepEqual(
    result.json.data.inventory.assets.map((asset) => asset.relativePath),
    [
      'Clips/Verse Groove.alc',
      'Max for Live Devices/Synth Tools/Scene Utility.amxd',
      'Presets/Audio Effects/Wide Chorus.adv',
      'Presets/Instruments/City Keys.adg',
      'Samples/Drums/Kick 01.wav',
      'Templates/City Pop Starter.als'
    ]
  )
})

test('scan_library remains local when a bridge is configured', async (t) => {
  const received = []
  const bridge = await startFakeBridge(async (request, response) => {
    const body = await readJsonRequest(request)
    received.push(body)

    writeJsonResponse(response, 200, {
      ok: true,
      id: body.id,
      dryRun: body.dryRun,
      summary: 'Fake bridge should not handle library scans',
      data: {
        bridge: 'fake'
      },
      warnings: []
    })
  })
  t.after(async () => bridge.close())

  const result = await runCliAsync(
    JSON.stringify({
      id: 'local-scan',
      action: 'scan_library',
      params: {
        libraryPath: fixtureLibrary
      }
    }),
    {
      env: {
        SCENELAB_BRIDGE_URL: bridge.url
      }
    }
  )

  assert.equal(result.status, 0)
  assert.equal(result.json.ok, true)
  assert.equal(result.json.summary, 'Scanned Ableton User Library: 6 assets')
  assert.deepEqual(received, [])
})

test('forwards requests to a configured bridge and returns bridge JSON', async (t) => {
  const received = []
  const bridge = await startFakeBridge(async (request, response) => {
    const body = await readJsonRequest(request)
    received.push(body)

    writeJsonResponse(response, 200, {
      ok: true,
      id: body.id,
      dryRun: body.dryRun,
      summary: 'Fake bridge handled status',
      data: {
        bridge: 'fake',
        action: body.action
      },
      warnings: []
    })
  })
  t.after(async () => bridge.close())

  const result = await runCliAsync(JSON.stringify({ id: 'bridge-status', action: 'status' }), {
    env: {
      SCENELAB_BRIDGE_URL: bridge.url
    }
  })

  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  assert.equal(result.json.ok, true)
  assert.equal(result.json.summary, 'Fake bridge handled status')
  assert.equal(result.json.data.bridge, 'fake')
  assert.deepEqual(received, [
    {
      id: 'bridge-status',
      action: 'status',
      dryRun: true,
      params: {}
    }
  ])
})

test('forwards confirmed mutation requests to the bridge', async (t) => {
  const received = []
  const bridge = await startFakeBridge(async (request, response) => {
    const body = await readJsonRequest(request)
    received.push(body)

    writeJsonResponse(response, 200, {
      ok: true,
      id: body.id,
      dryRun: body.dryRun,
      summary: 'Fake bridge created clip',
      data: {
        created: true
      },
      warnings: []
    })
  })
  t.after(async () => bridge.close())

  const result = await runCliAsync(
    JSON.stringify({
      id: 'create-clip',
      action: 'create_clip',
      dryRun: false,
      confirm: 'apply',
      params: {
        track: 1,
        scene: 1
      }
    }),
    {
      env: {
        SCENELAB_BRIDGE_URL: bridge.url
      }
    }
  )

  assert.equal(result.status, 0)
  assert.equal(result.json.ok, true)
  assert.equal(result.json.dryRun, false)
  assert.equal(result.json.data.created, true)
  assert.equal(received[0].action, 'create_clip')
  assert.equal(received[0].confirm, 'apply')
})

test('bridge HTTP failures are normalized and stdout remains JSON-only', async (t) => {
  const bridge = await startFakeBridge(async (_request, response) => {
    writeJsonResponse(response, 500, {
      ok: false,
      error: {
        code: 'live_api_failed',
        message: 'Fake Live API failure'
      }
    })
  })
  t.after(async () => bridge.close())

  const result = await runCliAsync(JSON.stringify({ id: 'bridge-error', action: 'status' }), {
    env: {
      SCENELAB_BRIDGE_URL: bridge.url
    }
  })

  assert.equal(result.status, 1)
  assert.equal(result.stderr, '')
  assert.equal(result.json.ok, false)
  assert.equal(result.json.id, 'bridge-error')
  assert.equal(result.json.error.code, 'bridge_error')
})

test('unavailable bridge is normalized and stdout remains JSON-only', () => {
  const result = runCli(JSON.stringify({ id: 'bridge-down', action: 'status' }), {
    env: {
      SCENELAB_BRIDGE_URL: 'http://127.0.0.1:9',
      SCENELAB_BRIDGE_TIMEOUT_MS: '100'
    }
  })

  assert.equal(result.status, 1)
  assert.equal(result.stderr, '')
  assert.equal(result.json.ok, false)
  assert.equal(result.json.id, 'bridge-down')
  assert.equal(result.json.error.code, 'bridge_unavailable')
})

function startFakeBridge(handler) {
  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/requests') {
      writeJsonResponse(response, 404, {
        ok: false,
        error: {
          code: 'not_found',
          message: 'No fake bridge route matched.'
        }
      })
      return
    }

    handler(request, response).catch((error) => {
      writeJsonResponse(response, 500, {
        ok: false,
        error: {
          code: 'fake_bridge_error',
          message: error instanceof Error ? error.message : String(error)
        }
      })
    })
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      assert.equal(typeof address, 'object')
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error) {
                rejectClose(error)
                return
              }

              resolveClose()
            })
            server.closeAllConnections()
          })
      })
    })
  })
}

function readJsonRequest(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('error', reject)
    request.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
  })
}

function writeJsonResponse(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json',
    connection: 'close'
  })
  response.end(JSON.stringify(body))
}
