'use strict'

const http = require('node:http')

const BRIDGE_VERSION = '0.0.0'

function createBridgeServer(options) {
  const config = {
    host: options?.host || '127.0.0.1',
    port: Number(options?.port ?? 31741),
    requestTimeoutMs: Number(options?.requestTimeoutMs ?? 5000),
    version: options?.version || BRIDGE_VERSION,
    liveAdapter: options?.liveAdapter
  }

  if (!config.liveAdapter) {
    throw new Error('createBridgeServer requires a liveAdapter')
  }

  const server = http.createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/requests') {
      writeHttpJson(response, 404, {
        ok: false,
        id: null,
        dryRun: null,
        summary: 'Route not found',
        error: {
          code: 'not_found',
          message: 'SceneLab bridge only supports POST /requests.'
        },
        warnings: []
      })
      return
    }

    const parsed = await readRequestJson(request)

    if (!parsed.ok) {
      writeSceneLabResponse(response, errorResponse(null, null, 'invalid_bridge_request', 'Bridge request JSON is invalid.', parsed.error))
      return
    }

    const bridgeRequest = normalizeBridgeRequest(parsed.data)

    if (!bridgeRequest.ok) {
      writeSceneLabResponse(
        response,
        errorResponse(getMaybeId(parsed.data), getMaybeDryRun(parsed.data), 'invalid_bridge_request', bridgeRequest.error, parsed.data)
      )
      return
    }

    const sceneLabResponse = await withTimeout(
      handleBridgeRequest(bridgeRequest.data, config),
      config.requestTimeoutMs,
      bridgeRequest.data
    )
    writeSceneLabResponse(response, sceneLabResponse)
  })

  server.scenelabBridgeConfig = config
  return server
}

function listenBridgeServer(server, host, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      const address = server.address()

      if (typeof address === 'object' && address !== null && server.scenelabBridgeConfig) {
        server.scenelabBridgeConfig.host = address.address
        server.scenelabBridgeConfig.port = address.port
      }

      server.off('error', reject)
      resolve(server)
    })
  })
}

async function handleBridgeRequest(request, config) {
  try {
    if (request.action === 'status') {
      const live = await config.liveAdapter.status()
      return okResponse(request, 'SceneLab bridge is running', {
        bridge: {
          version: config.version,
          host: config.host,
          port: config.port
        },
        live
      })
    }

    if (request.action === 'inspect_set') {
      const set = await config.liveAdapter.inspectSet()
      return okResponse(request, 'SceneLab inspected the Live set', {
        set
      })
    }

    if (isWriteAction(request.action)) {
      const dryRun = dryRunWriteResponse(request)

      if (dryRun) {
        return dryRun
      }

      if (request.confirm !== 'apply') {
        return errorResponse(request.id, request.dryRun, 'missing_apply_confirmation', 'Write requests require confirm: "apply".', {
          action: request.action
        })
      }

      return handleWriteRequest(request, config)
    }

    return errorResponse(request.id, request.dryRun, 'unsupported_operation', `Bridge action is not supported yet: ${request.action}`, {
      action: request.action
    })
  } catch (error) {
    return errorResponse(request.id, request.dryRun, error.code || 'live_api_error', error.message || 'Live API operation failed.', {
      name: error.name,
      message: error.message,
      details: error.details
    })
  }
}

async function handleWriteRequest(request, config) {
  if (request.action === 'create_scene') {
    const scene = await config.liveAdapter.createScene(request.params)
    return okResponse(request, 'SceneLab created a scene', {
      scene
    })
  }

  if (request.action === 'create_midi_track') {
    const track = await config.liveAdapter.createMidiTrack(request.params)
    return okResponse(request, 'SceneLab created a MIDI track', {
      track
    })
  }

  if (request.action === 'create_midi_clip' || request.action === 'create_clip') {
    const clip = await config.liveAdapter.createMidiClip(request.params)
    return okResponse(request, 'SceneLab created a MIDI clip', {
      clip
    })
  }

  if (request.action === 'set_clip_notes') {
    const clip = await config.liveAdapter.setClipNotes(request.params)
    return okResponse(request, 'SceneLab wrote MIDI notes', {
      clip
    })
  }

  if (request.action === 'set_clip_name') {
    const clip = await config.liveAdapter.setClipName(request.params)
    return okResponse(request, 'SceneLab set a clip name', {
      clip
    })
  }

  return errorResponse(request.id, request.dryRun, 'unsupported_operation', `Bridge action is not supported yet: ${request.action}`, {
    action: request.action
  })
}

function dryRunWriteResponse(request) {
  if (!request.dryRun || !isWriteAction(request.action)) {
    return null
  }

  return okResponse(request, `SceneLab dry-run planned ${request.action}`, {
    status: 'dry_run',
    action: request.action,
    params: request.params
  })
}

function isWriteAction(action) {
  return (
    action === 'create_scene' ||
    action === 'create_midi_track' ||
    action === 'create_midi_clip' ||
    action === 'create_clip' ||
    action === 'set_clip_notes' ||
    action === 'set_clip_name'
  )
}

function withTimeout(promise, timeoutMs, request) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(
        errorResponse(request.id, request.dryRun, 'bridge_request_timeout', 'SceneLab bridge request timed out.', {
          timeoutMs
        })
      )
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timeout)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timeout)
        resolve(
          errorResponse(request.id, request.dryRun, error.code || 'live_api_error', error.message || 'Live API operation failed.', {
            name: error.name,
            message: error.message,
            details: error.details
          })
        )
      })
  })
}

function normalizeBridgeRequest(input) {
  if (!isRecord(input)) {
    return { ok: false, error: 'Bridge request must be a JSON object.' }
  }

  if (typeof input.action !== 'string' || input.action.length === 0) {
    return { ok: false, error: 'Bridge request action is required.' }
  }

  return {
    ok: true,
    data: {
      id: typeof input.id === 'string' && input.id.length > 0 ? input.id : `bridge-${Date.now()}`,
      action: input.action,
      dryRun: typeof input.dryRun === 'boolean' ? input.dryRun : true,
      confirm: typeof input.confirm === 'string' ? input.confirm : undefined,
      params: isRecord(input.params) ? input.params : {}
    }
  }
}

function readRequestJson(request) {
  return new Promise((resolve) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('error', (error) => {
      resolve({ ok: false, error: { message: error.message } })
    })
    request.on('end', () => {
      try {
        resolve({ ok: true, data: body ? JSON.parse(body) : {} })
      } catch (error) {
        resolve({ ok: false, error: { message: error.message, body } })
      }
    })
  })
}

function okResponse(request, summary, data) {
  return {
    ok: true,
    id: request.id,
    dryRun: request.dryRun,
    summary,
    data,
    warnings: []
  }
}

function errorResponse(id, dryRun, code, message, details) {
  return {
    ok: false,
    id,
    dryRun,
    summary: message,
    error: {
      code,
      message,
      details
    },
    warnings: []
  }
}

function writeSceneLabResponse(response, body) {
  writeHttpJson(response, 200, body)
}

function writeHttpJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json',
    connection: 'close'
  })
  response.end(JSON.stringify(body))
}

function getMaybeId(input) {
  return isRecord(input) && typeof input.id === 'string' ? input.id : null
}

function getMaybeDryRun(input) {
  return isRecord(input) && typeof input.dryRun === 'boolean' ? input.dryRun : null
}

function isRecord(input) {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

module.exports = {
  createBridgeServer,
  listenBridgeServer,
  handleBridgeRequest,
  normalizeBridgeRequest
}
