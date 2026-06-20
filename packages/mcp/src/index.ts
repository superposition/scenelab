#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createCliRunner } from './cli.js'
import { createSceneLabMcpServer } from './server.js'

async function main(): Promise<void> {
  const server = createSceneLabMcpServer(createCliRunner())
  await server.connect(new StdioServerTransport())
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
