import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as z from 'zod/v4'
import type { RunCli, SceneLabCliRequest, SceneLabCliResponse } from './cli.js'

type SceneLabTool = {
  name: string
  title: string
  description: string
  action: string
  readOnly: boolean
}

const baseInputSchema = {
  id: z.string().min(1).optional().describe('Optional request id forwarded to the SceneLab CLI.'),
  dryRun: z.boolean().optional().describe('Defaults to true. Set false only with confirm: "apply" for mutating tools.'),
  confirm: z.literal('apply').optional().describe('Required by the CLI when dryRun is false for mutating tools.'),
  params: z.record(z.string(), z.unknown()).optional().describe('CLI params forwarded without MCP-side Ableton behavior.')
}

type ToolInput = {
  id?: string
  dryRun?: boolean
  confirm?: 'apply'
  params?: Record<string, unknown>
}

export const sceneLabTools: SceneLabTool[] = [
  {
    name: 'ableton_status',
    title: 'Ableton Status',
    description: 'Return SceneLab CLI and Ableton bridge status.',
    action: 'status',
    readOnly: true
  },
  {
    name: 'scan_library',
    title: 'Scan Library',
    description: 'Scan the Ableton User Library through the SceneLab CLI.',
    action: 'scan_library',
    readOnly: true
  },
  {
    name: 'plan_arrangement',
    title: 'Plan Arrangement',
    description: 'Ask the SceneLab CLI to produce a dry-run arrangement plan.',
    action: 'plan_arrangement',
    readOnly: true
  },
  {
    name: 'apply_arrangement',
    title: 'Apply Arrangement',
    description: 'Apply or dry-run an existing arrangement plan through the SceneLab CLI.',
    action: 'apply_plan',
    readOnly: false
  },
  {
    name: 'create_clip',
    title: 'Create Clip',
    description: 'Create or dry-run clip creation through the SceneLab CLI.',
    action: 'create_clip',
    readOnly: false
  },
  {
    name: 'load_rack',
    title: 'Load Rack',
    description: 'Load or dry-run rack loading through the SceneLab CLI.',
    action: 'load_rack',
    readOnly: false
  },
  {
    name: 'write_automation',
    title: 'Write Automation',
    description: 'Write or dry-run automation through the SceneLab CLI.',
    action: 'write_automation',
    readOnly: false
  }
]

export function registerSceneLabTools(server: McpServer, runCli: RunCli): void {
  for (const tool of sceneLabTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: baseInputSchema,
        annotations: {
          readOnlyHint: tool.readOnly,
          destructiveHint: false,
          idempotentHint: tool.readOnly,
          openWorldHint: false
        }
      },
      async (input) => callSceneLabTool(tool, input as ToolInput, runCli)
    )
  }
}

export async function callSceneLabTool(tool: SceneLabTool, input: ToolInput, runCli: RunCli): Promise<CallToolResult> {
  const response = await runCli(toCliRequest(tool, input))
  return toToolResult(response)
}

export function toCliRequest(tool: SceneLabTool, input: ToolInput): SceneLabCliRequest {
  return {
    ...(input.id ? { id: input.id } : {}),
    action: tool.action,
    dryRun: input.dryRun ?? true,
    ...(input.confirm ? { confirm: input.confirm } : {}),
    params: input.params ?? {}
  }
}

function toToolResult(response: SceneLabCliResponse): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }
    ],
    structuredContent: response as Record<string, unknown>,
    ...(response.ok ? {} : { isError: true })
  }
}
