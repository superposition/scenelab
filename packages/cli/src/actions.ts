import type { SceneLabRequest, SceneLabResponse, SceneLabWarning } from './schema.js'
import { callBridge, getBridgeUrl } from './bridge.js'
import { scanLibrary } from './library.js'
import { TemplateRegistryError } from './templates.js'
import { planArrangement } from './planner.js'

export async function handleRequest(request: SceneLabRequest): Promise<SceneLabResponse> {
  const bridgeUrl = getBridgeUrl()

  if (request.action === 'scan_library') {
    return handleScanLibrary(request)
  }

  if (request.action === 'plan_arrangement') {
    return handlePlanArrangement(request)
  }

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

    case 'apply_plan':
      return ok(request, request.dryRun ? 'Plan apply dry-run is not implemented yet' : 'Plan apply is not implemented yet', {
        status: 'not_implemented'
      })

    case 'create_scene':
      return ok(request, request.dryRun ? 'Scene creation dry-run is not implemented without a bridge' : 'Scene creation is not implemented without a bridge', {
        status: 'not_implemented'
      })

    case 'create_midi_track':
      return ok(request, request.dryRun ? 'MIDI track creation dry-run is not implemented without a bridge' : 'MIDI track creation is not implemented without a bridge', {
        status: 'not_implemented'
      })

    case 'create_midi_clip':
      return ok(request, request.dryRun ? 'MIDI clip creation dry-run is not implemented without a bridge' : 'MIDI clip creation is not implemented without a bridge', {
        status: 'not_implemented'
      })

    case 'create_clip':
      return ok(request, request.dryRun ? 'Clip creation dry-run is not implemented yet' : 'Clip creation is not implemented yet', {
        status: 'not_implemented'
      })

    case 'set_clip_notes':
      return ok(request, request.dryRun ? 'Clip note writing dry-run is not implemented without a bridge' : 'Clip note writing is not implemented without a bridge', {
        status: 'not_implemented'
      })

    case 'set_clip_name':
      return ok(request, request.dryRun ? 'Clip name writing dry-run is not implemented without a bridge' : 'Clip name writing is not implemented without a bridge', {
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

async function handleScanLibrary(request: SceneLabRequest): Promise<SceneLabResponse> {
  try {
    const result = await scanLibrary({
      libraryPath: typeof request.params.libraryPath === 'string' ? request.params.libraryPath : undefined
    })

    return ok(request, `Scanned Ableton User Library: ${result.inventory.assetCount} assets`, {
      inventory: result.inventory
    }, result.warnings)
  } catch (error) {
    return fail(request, 'Library scanning failed', {
      code: 'library_scan_error',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

async function handlePlanArrangement(request: SceneLabRequest): Promise<SceneLabResponse> {
  try {
    const plan = await planArrangement({
      templateId: typeof request.params.templateId === 'string' ? request.params.templateId : undefined
    })

    return ok(request, `Planned ${plan.templateName}`, {
      plan
    })
  } catch (error) {
    if (error instanceof TemplateRegistryError) {
      return fail(request, error.message, {
        code: error.code,
        message: error.message,
        details: error.details
      })
    }

    return fail(request, 'Arrangement planning failed', {
      code: 'arrangement_planning_error',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

function ok(request: SceneLabRequest, summary: string, data: Record<string, unknown>, warnings: SceneLabWarning[] = []): SceneLabResponse {
  return {
    ok: true,
    id: request.id,
    dryRun: request.dryRun,
    summary,
    data,
    warnings: []
  }
}

function fail(request: SceneLabRequest, summary: string, error: { code: string; message: string; details?: unknown }): SceneLabResponse {
  return {
    ok: false,
    id: request.id,
    dryRun: request.dryRun,
    summary,
    error,
    warnings: []
  }
}
