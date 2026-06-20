import type { SceneLabRequest, SceneLabResponse } from './schema.js'

export function getBridgeUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.SCENELAB_BRIDGE_URL?.trim()

  if (!value) {
    return null
  }

  return value.replace(/\/+$/, '')
}

export function getBridgeTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.SCENELAB_BRIDGE_TIMEOUT_MS ?? 3000)

  if (!Number.isFinite(value) || value <= 0) {
    return 3000
  }

  return value
}

export async function callBridge(bridgeUrl: string, request: SceneLabRequest): Promise<SceneLabResponse> {
  let response: Response
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getBridgeTimeoutMs())

  try {
    response = await fetch(`${bridgeUrl}/requests`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(request),
      signal: controller.signal
    })
  } catch (error) {
    return bridgeError(request, 'bridge_unavailable', 'SceneLab bridge is unavailable.', error)
  } finally {
    clearTimeout(timeout)
  }

  const text = await response.text()
  let payload: unknown

  try {
    payload = text ? JSON.parse(text) : null
  } catch (error) {
    return bridgeError(request, 'bridge_invalid_response', 'SceneLab bridge returned invalid JSON.', {
      status: response.status,
      body: text,
      parseError: error instanceof Error ? error.message : String(error)
    })
  }

  if (!response.ok) {
    return bridgeError(request, 'bridge_error', 'SceneLab bridge returned an error.', {
      status: response.status,
      response: payload
    })
  }

  if (isSceneLabResponse(payload)) {
    return payload
  }

  return bridgeError(request, 'bridge_invalid_response', 'SceneLab bridge response did not match the expected shape.', {
    status: response.status,
    response: payload
  })
}

function bridgeError(request: SceneLabRequest, code: string, message: string, details: unknown): SceneLabResponse {
  return {
    ok: false,
    id: request.id,
    dryRun: request.dryRun,
    summary: message,
    error: {
      code,
      message,
      details: normalizeErrorDetails(details)
    },
    warnings: []
  }
}

function normalizeErrorDetails(details: unknown): unknown {
  if (details instanceof Error) {
    return {
      name: details.name,
      message: details.message
    }
  }

  return details
}

function isSceneLabResponse(value: unknown): value is SceneLabResponse {
  if (!isRecord(value)) {
    return false
  }

  if (typeof value.ok !== 'boolean' || !Array.isArray(value.warnings) || typeof value.summary !== 'string') {
    return false
  }

  if (value.ok) {
    return typeof value.id === 'string' && typeof value.dryRun === 'boolean' && isRecord(value.data)
  }

  return (
    (typeof value.id === 'string' || value.id === null) &&
    (typeof value.dryRun === 'boolean' || value.dryRun === null) &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
