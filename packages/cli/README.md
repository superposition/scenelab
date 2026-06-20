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
- `inspect_set`
- `scan_library`
- `plan_arrangement`
- `apply_plan`
- `create_scene`
- `create_midi_track`
- `create_midi_clip`
- `create_clip`
- `set_clip_notes`
- `set_clip_name`
- `load_rack`
- `write_automation`

## Bridge URL

By default, the CLI returns local placeholder responses. Set `SCENELAB_BRIDGE_URL` to send validated requests to a running bridge:

```sh
SCENELAB_BRIDGE_URL=http://127.0.0.1:31741 scenelab
```

The CLI sends the same request JSON to:

```text
POST /requests
```

Bridge failures are normalized into JSON error responses.

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
