import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url))

function runCli(input) {
  const result = spawnSync(process.execPath, [cli], {
    input,
    encoding: 'utf8'
  })

  return {
    ...result,
    json: JSON.parse(result.stdout)
  }
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
