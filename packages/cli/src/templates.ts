import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

export const genreFamilySchema = z.enum(['drum-and-bass', 'jazz', 'rock', 'city-pop', 'modern-pop'])

const meterSchema = z.object({
  numerator: z.number().int().positive(),
  denominator: z.number().int().positive(),
  feel: z.string().min(1),
  subdivisions: z.array(z.string().min(1)).default([])
}).strict()

const tempoRangeSchema = z.object({
  minBpm: z.number().positive(),
  maxBpm: z.number().positive(),
  defaultBpm: z.number().positive()
}).strict().superRefine((tempo, ctx) => {
  if (tempo.minBpm > tempo.maxBpm) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['minBpm'],
      message: 'minBpm must be less than or equal to maxBpm.'
    })
  }

  if (tempo.defaultBpm < tempo.minBpm || tempo.defaultBpm > tempo.maxBpm) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultBpm'],
      message: 'defaultBpm must fall within minBpm and maxBpm.'
    })
  }
})

const sectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  bars: z.number().int().positive(),
  energy: z.number().min(0).max(1),
  roles: z.array(z.string().min(1)).min(1)
}).strict()

const trackSchema = z.object({
  role: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['audio', 'midi', 'return', 'bus']),
  required: z.boolean(),
  sound: z.string().min(1).optional()
}).strict()

const assetReferenceSchema = z.object({
  role: z.string().min(1),
  name: z.string().min(1),
  required: z.boolean(),
  tags: z.array(z.string().min(1)).default([])
}).strict()

export const templateSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use kebab-case ids.'),
  type: z.literal('arrangement'),
  name: z.string().min(1),
  description: z.string().min(1),
  genreFamily: genreFamilySchema,
  meter: meterSchema,
  tempoRange: tempoRangeSchema,
  harmony: z.object({
    keyCenter: z.string().min(1),
    mode: z.string().min(1),
    language: z.array(z.string().min(1)).min(1),
    movement: z.array(z.string().min(1)).min(1),
    voiceLeading: z.array(z.string().min(1)).min(1)
  }).strict(),
  rhythm: z.object({
    groove: z.string().min(1),
    humanization: z.string().min(1),
    patterns: z.array(z.object({
      role: z.string().min(1),
      description: z.string().min(1),
      lengthBars: z.number().positive()
    }).strict()).min(1)
  }).strict(),
  instrumentation: z.object({
    tracks: z.array(trackSchema).min(1)
  }).strict(),
  arrangementRoles: z.object({
    sections: z.array(sectionSchema).min(1)
  }).strict(),
  energyCurve: z.array(z.object({
    sectionId: z.string().min(1),
    energy: z.number().min(0).max(1)
  }).strict()).min(1),
  assets: z.object({
    racks: z.array(assetReferenceSchema).default([]),
    samples: z.array(assetReferenceSchema).default([]),
    warnings: z.array(z.string().min(1)).default([])
  }).strict(),
  automation: z.object({
    lanes: z.array(z.object({
      target: z.string().min(1),
      gesture: z.string().min(1),
      sections: z.array(z.string().min(1)).min(1)
    }).strict()).default([])
  }).strict(),
  mix: z.object({
    headroomDb: z.number(),
    buses: z.array(z.string().min(1)).min(1),
    expectations: z.array(z.string().min(1)).min(1)
  }).strict()
}).strict().superRefine((template, ctx) => {
  const sectionIds = new Set(template.arrangementRoles.sections.map((section) => section.id))

  for (const point of template.energyCurve) {
    if (!sectionIds.has(point.sectionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['energyCurve'],
        message: `Unknown sectionId "${point.sectionId}".`
      })
    }
  }

  for (const lane of template.automation.lanes) {
    for (const sectionId of lane.sections) {
      if (!sectionIds.has(sectionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['automation', 'lanes'],
          message: `Unknown automation section "${sectionId}".`
        })
      }
    }
  }
})

export type SceneLabTemplate = z.infer<typeof templateSchema>

export type TemplateRegistry = {
  templates: SceneLabTemplate[]
  byId: Map<string, SceneLabTemplate>
  directory: string
}

export class TemplateRegistryError extends Error {
  readonly code = 'template_registry_error'
  readonly details: unknown

  constructor(message: string, details: unknown) {
    super(message)
    this.name = 'TemplateRegistryError'
    this.details = details
  }
}

export async function loadTemplateRegistry(directory = defaultTemplateDirectory()): Promise<TemplateRegistry> {
  const files = await findJsonFiles(directory)
  const templates = await Promise.all(files.map((file) => loadTemplateFile(file)))
  const byId = new Map<string, SceneLabTemplate>()

  for (const template of templates) {
    const existing = byId.get(template.id)

    if (existing) {
      throw new TemplateRegistryError(`Duplicate template id "${template.id}".`, {
        id: template.id,
        firstName: existing.name,
        duplicateName: template.name
      })
    }

    byId.set(template.id, template)
  }

  return {
    templates: templates.sort((a, b) => a.id.localeCompare(b.id)),
    byId,
    directory
  }
}

export async function loadTemplateFile(filePath: string): Promise<SceneLabTemplate> {
  let parsed: unknown

  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    throw new TemplateRegistryError(`Template JSON could not be read: ${filePath}`, {
      filePath,
      message: error instanceof Error ? error.message : String(error)
    })
  }

  const result = templateSchema.safeParse(parsed)

  if (!result.success) {
    throw new TemplateRegistryError(`Template validation failed: ${filePath}`, {
      filePath,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
        code: issue.code
      }))
    })
  }

  return result.data
}

async function findJsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return findJsonFiles(entryPath)
    }

    return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : []
  }))

  return files.flat().sort()
}

function defaultTemplateDirectory(): string {
  return process.env.SCENELAB_TEMPLATE_DIR ?? path.resolve(process.cwd(), 'templates')
}
