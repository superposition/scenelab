# SceneLab CLI

The `scenelab` CLI is the stable interface for agents, scripts, tests, and MCP clients.

## Contract

- Read JSON from stdin.
- Write JSON response to stdout.
- Write logs and debug output to stderr.
- Default to dry-run.
- Require `confirm: "apply"` for write operations.

## Initial Actions

- `status`
- `scan_library`
- `plan_arrangement`
- `apply_plan`
- `create_clip`
- `load_rack`
- `write_automation`

## Request

```json
{
  "id": "request-id",
  "action": "status",
  "dryRun": true,
  "params": {}
}
```

## Response

```json
{
  "ok": true,
  "id": "request-id",
  "dryRun": true,
  "summary": "SceneLab bridge is reachable",
  "data": {},
  "warnings": []
}
```

