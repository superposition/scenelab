import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RunCli } from './cli.js'
import { registerSceneLabTools } from './tools.js'

export function createSceneLabMcpServer(runCli: RunCli): McpServer {
  const server = new McpServer({
    name: 'scenelab-mcp',
    version: '0.0.0'
  })

  registerSceneLabTools(server, runCli)
  return server
}
