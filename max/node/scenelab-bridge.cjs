#!/usr/bin/env node
'use strict'

const { createBridgeServer, listenBridgeServer } = require('./src/server.cjs')
const { createMaxApiLiveAdapter, createUnavailableLiveAdapter } = require('./src/live-adapter.cjs')

async function main() {
  const maxApi = loadMaxApi()
  const liveAdapter = maxApi
    ? createMaxApiLiveAdapter(maxApi)
    : createUnavailableLiveAdapter('max-api module is not available outside Node for Max')

  const host = process.env.SCENELAB_BRIDGE_HOST || '127.0.0.1'
  const port = Number(process.env.SCENELAB_BRIDGE_PORT || 31741)
  const requestTimeoutMs = Number(process.env.SCENELAB_BRIDGE_REQUEST_TIMEOUT_MS || 5000)

  const server = createBridgeServer({
    host,
    port,
    requestTimeoutMs,
    liveAdapter
  })

  await listenBridgeServer(server, host, port)
  post(maxApi, `SceneLab bridge listening on http://${host}:${port}`)
}

function loadMaxApi() {
  try {
    return require('max-api')
  } catch (_error) {
    return null
  }
}

function post(maxApi, message) {
  if (maxApi) {
    maxApi.post(message)
    return
  }

  process.stderr.write(`${message}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`)
  process.exitCode = 1
})

