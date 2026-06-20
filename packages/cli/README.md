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

## Arrangement Planning

`plan_arrangement` runs locally in the CLI so plans can be generated without Ableton running.

The v1 proof template is `city-pop-6-8`:

```json
{
  "action": "plan_arrangement",
  "params": {
    "templateId": "city-pop-6-8"
  }
}
```

The response includes a dry-run plan with scenes, tracks, clips, MIDI notes, automation intent, asset expectations, mix expectations, and warnings. If no `templateId` is provided, the CLI defaults to `city-pop-6-8`.

## Library Scanning

`scan_library` runs locally in the CLI and indexes the Ableton User Library without requiring Ableton or the bridge.

By default it scans:

```text
~/Music/Ableton/User Library
```

Use `params.libraryPath` or `SCENELAB_LIBRARY_PATH` to scan another folder:

```json
{
  "action": "scan_library",
  "params": {
    "libraryPath": "~/Music/Ableton/User Library"
  }
}
```

Supported asset types:

- racks: `.adg`
- clips: `.alc`
- samples: `.wav`, `.aif`, `.aiff`, `.flac`, `.mp3`, `.m4a`, `.ogg`
- presets: `.adv`
- templates: `.als`
- Max for Live devices: `.amxd`

The response includes a stable inventory sorted by relative path. Each asset has `path`, `relativePath`, `type`, `name`, `extension`, and inferred `tags`. Missing or unreadable folders are returned as response warnings with an empty inventory instead of silent success.

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
