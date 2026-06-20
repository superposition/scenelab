import { z } from 'zod'
import { randomUUID } from 'node:crypto'

export const actions = [
  'status',
  'scan_library',
  'plan_arrangement',
  'apply_plan',
  'create_clip',
  'load_rack',
  'write_automation'
] as const

export type SceneLabAction = (typeof actions)[number]

const mutatingActions = new Set<SceneLabAction>([
  'apply_plan',
  'create_clip',
  'load_rack',
  'write_automation'
])

const baseRequestSchema = z.object({
  id: z.string().min(1).default(() => randomUUID()),
  action: z.enum(actions),
  dryRun: z.boolean().default(true),
  confirm: z.string().optional(),
  params: z.record(z.unknown()).default({})
})

export const requestSchema = baseRequestSchema.superRefine((request, ctx) => {
  if (!request.dryRun && mutatingActions.has(request.action) && request.confirm !== 'apply') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirm'],
      message: 'Mutating requests require confirm: "apply" when dryRun is false.'
    })
  }
})

export type SceneLabRequest = z.infer<typeof requestSchema>

export type SceneLabWarning = {
  code: string
  message: string
  details?: unknown
}

export type SceneLabError = {
  code: string
  message: string
  details?: unknown
}

export type SceneLabResponse =
  | {
      ok: true
      id: string
      dryRun: boolean
      summary: string
      data: Record<string, unknown>
      warnings: SceneLabWarning[]
    }
  | {
      ok: false
      id: string | null
      dryRun: boolean | null
      summary: string
      error: SceneLabError
      warnings: SceneLabWarning[]
    }

export type SceneLabErrorResponse = Extract<SceneLabResponse, { ok: false }>

export function parseRequest(input: unknown): SceneLabRequest | SceneLabErrorResponse {
  const result = requestSchema.safeParse(input)

  if (result.success) {
    return result.data
  }

  return {
    ok: false,
    id: getMaybeId(input),
    dryRun: getMaybeDryRun(input),
    summary: 'Invalid SceneLab request',
    error: {
      code: 'invalid_request',
      message: 'Request did not match the SceneLab CLI schema.',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    },
    warnings: []
  }
}

function getMaybeId(input: unknown): string | null {
  if (isRecord(input) && typeof input.id === 'string') {
    return input.id
  }

  return null
}

function getMaybeDryRun(input: unknown): boolean | null {
  if (isRecord(input) && typeof input.dryRun === 'boolean') {
    return input.dryRun
  }

  return null
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}
