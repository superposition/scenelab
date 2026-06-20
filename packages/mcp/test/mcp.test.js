import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createCliRunner } from '../dist/cli.js'
import { createSceneLabMcpServer } from '../dist/server.js'

const expectedToolNames = [
  'ableton_status',
  'scan_library',
  'plan_arrangement',
  'apply_arrangement',
  'create_clip',
  'load_rack',
  'write_automation'
]

test('lists SceneLab MCP tools and calls ableton_status through the CLI wrapper', async (t) => {
  const received = []
  const { client } = await startMcpTestServer(t, async (request) => {
    received.push(request)
    return okResponse(request, {
      bridge: 'mock',
      action: request.action
    })
  })

  const tools = await client.listTools()
  const toolNames = tools.tools.map((tool) => tool.name).sort()

  assert.deepEqual(toolNames, [...expectedToolNames].sort())
  assert.equal(tools.tools.find((tool) => tool.name === 'ableton_status')?.description, 'Return SceneLab CLI and Ableton bridge status.')

  const result = await client.callTool({
    name: 'ableton_status',
    arguments: {
      id: 'status-1'
    }
  })

  assert.equal(result.isError, undefined)
  assert.equal(result.structuredContent.ok, true)
  assert.equal(result.structuredContent.data.action, 'status')
  assert.deepEqual(received, [
    {
      id: 'status-1',
      action: 'status',
      dryRun: true,
      params: {}
    }
  ])
})

test('maps apply_arrangement to the CLI apply_plan action with confirmation', async (t) => {
  const received = []
  const { client } = await startMcpTestServer(t, async (request) => {
    received.push(request)
    return okResponse(request, {
      applied: request.action === 'apply_plan'
    })
  })

  const result = await client.callTool({
    name: 'apply_arrangement',
    arguments: {
      id: 'apply-1',
      dryRun: false,
      confirm: 'apply',
      params: {
        planId: 'city-pop-6-8'
      }
    }
  })

  assert.equal(result.structuredContent.ok, true)
  assert.equal(result.structuredContent.data.applied, true)
  assert.deepEqual(received, [
    {
      id: 'apply-1',
      action: 'apply_plan',
      dryRun: false,
      confirm: 'apply',
      params: {
        planId: 'city-pop-6-8'
      }
    }
  ])
})

test('returns CLI error JSON as an MCP tool error result', async (t) => {
  const { client } = await startMcpTestServer(t, async (request) => ({
    ok: false,
    id: request.id ?? null,
    dryRun: request.dryRun ?? null,
    summary: 'Invalid SceneLab request',
    error: {
      code: 'invalid_request',
      message: 'Mutating requests require confirm: "apply".'
    },
    warnings: []
  }))

  const result = await client.callTool({
    name: 'create_clip',
    arguments: {
      id: 'missing-confirm',
      dryRun: false,
      params: {
        trackIndex: 0,
        sceneIndex: 0
      }
    }
  })

  assert.equal(result.isError, true)
  assert.equal(result.structuredContent.ok, false)
  assert.equal(result.structuredContent.error.code, 'invalid_request')
  assert.match(result.content[0].text, /Mutating requests require/)
})

test('CLI runner sends JSON to a process and parses normalized CLI JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'scenelab-mcp-'))
  const fakeCliPath = path.join(dir, 'fake-cli.mjs')

  await writeFile(fakeCliPath, `
let stdin = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => { stdin += chunk })
process.stdin.on('end', () => {
  const request = JSON.parse(stdin)
  process.stdout.write(JSON.stringify({
    ok: true,
    id: request.id,
    dryRun: request.dryRun,
    summary: 'fake cli response',
    data: { request },
    warnings: []
  }))
})
`)

  const runCli = createCliRunner({
    command: process.execPath,
    args: [fakeCliPath]
  })
  const response = await runCli({
    id: 'runner-1',
    action: 'scan_library',
    dryRun: true,
    params: {
      libraryPath: '/tmp/Ableton User Library'
    }
  })

  assert.equal(response.ok, true)
  assert.deepEqual(response.data.request, {
    id: 'runner-1',
    action: 'scan_library',
    dryRun: true,
    params: {
      libraryPath: '/tmp/Ableton User Library'
    }
  })
})

async function startMcpTestServer(t, runCli) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createSceneLabMcpServer(runCli)
  const client = new Client({
    name: 'scenelab-mcp-test-client',
    version: '0.0.0'
  })

  await server.connect(serverTransport)
  await client.connect(clientTransport)

  t.after(async () => {
    await client.close()
    await server.close()
  })

  return { client, server }
}

function okResponse(request, data) {
  return {
    ok: true,
    id: request.id ?? 'mock-id',
    dryRun: request.dryRun ?? true,
    summary: 'mock cli response',
    data,
    warnings: []
  }
}
