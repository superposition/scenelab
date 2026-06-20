# SceneLab MCP

The MCP server is a thin wrapper around the SceneLab CLI.

It should expose agent-friendly tools while keeping all Ableton behavior in the CLI and bridge layers.

## Tools

- `ableton_status`
- `scan_library`
- `plan_arrangement`
- `apply_arrangement`
- `create_clip`
- `load_rack`
- `write_automation`

Each tool should call the CLI with a JSON request and return the CLI response without inventing a separate behavior model.

## Input Shape

All tools accept the same wrapper fields:

```json
{
  "id": "optional-request-id",
  "dryRun": true,
  "confirm": "apply",
  "params": {}
}
```

`dryRun` defaults to `true`. Mutating CLI requests still require `confirm: "apply"` when `dryRun` is `false`.

`apply_arrangement` maps to the CLI `apply_plan` action. The other MCP tools map directly to their CLI action names, except `ableton_status`, which maps to `status`.

## Local Inspector

Build the workspaces first:

```sh
npm run build
```

Then point MCP Inspector at the stdio entrypoint:

```sh
npx @modelcontextprotocol/inspector node packages/mcp/dist/index.js
```

Set `SCENELAB_BRIDGE_URL` if calls should reach a running Max for Live bridge through the CLI.
