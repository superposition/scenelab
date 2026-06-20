import type { SceneLabRequest, SceneLabResponse } from './schema.js'
import { callBridge, getBridgeUrl } from './bridge.js'

export async function handleRequest(request: SceneLabRequest): Promise<SceneLabResponse> {
  const bridgeUrl = getBridgeUrl()

  if (bridgeUrl) {
    return callBridge(bridgeUrl, request)
  }

  switch (request.action) {
    case 'status':
      return ok(request, 'SceneLab CLI is ready', {
        cli: 'ready',
        bridge: 'not_connected'
      })

    case 'inspect_set':
      return ok(request, 'Set inspection is not implemented without a bridge', {
        status: 'not_implemented'
      })

    case 'scan_library':
      return ok(request, 'Library scanning is not implemented yet', {
        status: 'not_implemented'
      })

    case 'plan_arrangement':
      return ok(request, 'Arrangement planning is not implemented yet', {
        status: 'not_implemented'
      })

    case 'apply_plan':
      return ok(request, request.dryRun ? 'Plan apply dry-run is not implemented yet' : 'Plan apply is not implemented yet', {
        status: 'not_implemented'
      })

    case 'create_clip':
      return ok(request, request.dryRun ? 'Clip creation dry-run is not implemented yet' : 'Clip creation is not implemented yet', {
        status: 'not_implemented'
      })

    case 'load_rack':
      return ok(request, request.dryRun ? 'Rack loading dry-run is not implemented yet' : 'Rack loading is not implemented yet', {
        status: 'not_implemented'
      })

    case 'write_automation':
      return ok(request, request.dryRun ? 'Automation dry-run is not implemented yet' : 'Automation writing is not implemented yet', {
        status: 'not_implemented'
      })
  }
}

function ok(request: SceneLabRequest, summary: string, data: Record<string, unknown>): SceneLabResponse {
  return {
    ok: true,
    id: request.id,
    dryRun: request.dryRun,
    summary,
    data,
    warnings: []
  }
}
