import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process'
import * as z from 'zod/v4'

export type SceneLabCliRequest = {
  id?: string
  action: string
  dryRun?: boolean
  confirm?: string
  params?: Record<string, unknown>
}

const warningSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional()
}).passthrough()

const cliSuccessResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
  dryRun: z.boolean(),
  summary: z.string(),
  data: z.record(z.string(), z.unknown()),
  warnings: z.array(warningSchema)
}).passthrough()

const cliErrorResponseSchema = z.object({
  ok: z.literal(false),
  id: z.string().nullable(),
  dryRun: z.boolean().nullable(),
  summary: z.string(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  }).passthrough(),
  warnings: z.array(warningSchema)
}).passthrough()

export const cliResponseSchema = z.discriminatedUnion('ok', [cliSuccessResponseSchema, cliErrorResponseSchema])

export type SceneLabCliResponse = z.infer<typeof cliResponseSchema>
export type RunCli = (request: SceneLabCliRequest) => Promise<SceneLabCliResponse>
export type SpawnSceneLabProcess = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
) => ChildProcessWithoutNullStreams

export type CliRunnerOptions = {
  command?: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  spawnProcess?: SpawnSceneLabProcess
}

export function createCliRunner(options: CliRunnerOptions = {}): RunCli {
  const commandConfig = options.command
    ? { command: options.command, args: options.args ?? [] }
    : defaultCliCommand()
  const spawnProcess = options.spawnProcess ?? spawn

  return (request) => runCliProcess(request, {
    ...commandConfig,
    cwd: options.cwd,
    env: options.env,
    spawnProcess
  })
}

function runCliProcess(
  request: SceneLabCliRequest,
  options: {
    command: string
    args: string[]
    cwd?: string
    env?: NodeJS.ProcessEnv
    spawnProcess: SpawnSceneLabProcess
  }
): Promise<SceneLabCliResponse> {
  return new Promise((resolve, reject) => {
    const child = options.spawnProcess(options.command, options.args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env
      },
      stdio: 'pipe'
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
    child.on('close', () => {
      let parsed: unknown

      try {
        parsed = JSON.parse(stdout)
      } catch (error) {
        reject(new Error(`SceneLab CLI did not return JSON: ${error instanceof Error ? error.message : String(error)}${stderr ? `\nstderr: ${stderr}` : ''}`))
        return
      }

      const result = cliResponseSchema.safeParse(parsed)

      if (!result.success) {
        reject(new Error(`SceneLab CLI returned an invalid response: ${result.error.message}`))
        return
      }

      resolve(result.data)
    })

    child.stdin.end(JSON.stringify(request))
  })
}

function defaultCliCommand(): { command: string; args: string[] } {
  const require = createRequire(import.meta.url)
  return {
    command: process.execPath,
    args: [require.resolve('@scenelab/cli')]
  }
}
