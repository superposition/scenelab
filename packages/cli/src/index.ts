#!/usr/bin/env node
import { handleRequest } from './actions.js'
import { parseRequest } from './schema.js'

async function main(): Promise<void> {
  const raw = await readStdin()
  let input: unknown

  try {
    input = raw.trim() === '' ? {} : JSON.parse(raw)
  } catch (error) {
    writeJson({
      ok: false,
      id: null,
      dryRun: null,
      summary: 'Invalid JSON',
      error: {
        code: 'invalid_json',
        message: error instanceof Error ? error.message : 'Input could not be parsed as JSON.'
      },
      warnings: []
    })
    process.exitCode = 1
    return
  }

  const parsed = parseRequest(input)

  if ('ok' in parsed) {
    writeJson(parsed)
    process.exitCode = 1
    return
  }

  const response = await handleRequest(parsed)
  writeJson(response)

  if (!response.ok) {
    process.exitCode = 1
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('error', reject)
    process.stdin.on('end', () => resolve(data))
  })
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  writeJson({
    ok: false,
    id: null,
    dryRun: null,
    summary: 'Unhandled CLI error',
    error: {
      code: 'unhandled_error',
      message: error instanceof Error ? error.message : String(error)
    },
    warnings: []
  })
  process.exitCode = 1
})
