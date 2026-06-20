# SceneLab Max for Live Bridge Design

This document is the implementation target for `SceneLab Bridge.amxd`.

V1 targets Ableton Live 11 Suite with the bundled Max runtime. Local inspection confirms the Live 11 Suite bundle includes:

- Max starter devices: `Max Audio Effect.amxd`, `Max Instrument.amxd`, `Max MIDI Effect.amxd`
- Node for Max package
- `node.script`
- `max-api`
- Live API Max objects: `live.path`, `live.object`, `live.observer`
- JavaScript Live API extension: `LiveAPI`

## Boundary

The Max for Live bridge is the only SceneLab component that directly touches Ableton Live.

The CLI owns:

- request validation
- dry-run and apply confirmation
- library scanning
- template planning
- bridge timeout and HTTP client behavior
- normalized JSON output

The MCP server owns:

- MCP tool definitions
- converting MCP tool input into CLI JSON
- returning CLI JSON to the calling agent

The Max bridge owns:

- Ableton Live API access
- Live set inspection
- non-destructive Live mutations
- converting Live API failures into SceneLab response JSON

## Device Shape

Create `SceneLab Bridge.amxd` as a Max MIDI Effect device first.

Rationale:

- It can be dropped on any MIDI track in Live 11 Suite.
- It does not need to process audio.
- It can still inspect and mutate the wider Live Set through the Live API.

The visible device surface should stay minimal:

- bridge status
- bound host and port
- last request id
- last action
- last result
- start/stop controls for the Node adapter

The patch should contain:

- `node.script scenelab-bridge.js @autostart 1`
- a status outlet from `node.script` to visible status UI
- a request outlet from `node.script` to the Live API router subpatch
- a response inlet back into `node.script`
- `live.path` objects for resolving Live paths
- `live.object` objects for `get`, `set`, and `call` messages
- `live.observer` objects only for optional status/state observations

Keep all Live API routing in Max patchers or Max JS that is loaded by the Max device. Do not let the external CLI or MCP server call Live APIs directly.

## Node for Max Adapter

The Node adapter runs from `node.script` and uses the `max-api` module.

Responsibilities:

- listen on `127.0.0.1`
- default port: `31741`
- expose `POST /requests`
- parse request JSON
- assign an internal bridge correlation id
- enqueue the request
- send one request at a time into Max
- wait for the Max-side result
- return a SceneLab response JSON object

The adapter should use only localhost. V1 should not bind `0.0.0.0`.

Environment/configuration:

- `SCENELAB_BRIDGE_HOST`, default `127.0.0.1`
- `SCENELAB_BRIDGE_PORT`, default `31741`
- `SCENELAB_BRIDGE_REQUEST_TIMEOUT_MS`, default `5000`

The external CLI already supports:

- `SCENELAB_BRIDGE_URL`
- `SCENELAB_BRIDGE_TIMEOUT_MS`

## HTTP Contract

Endpoint:

```text
POST /requests
```

Request body:

```json
{
  "id": "request-id",
  "action": "status",
  "dryRun": true,
  "params": {}
}
```

Response body:

```json
{
  "ok": true,
  "id": "request-id",
  "dryRun": true,
  "summary": "SceneLab bridge is running",
  "data": {},
  "warnings": []
}
```

Error response body:

```json
{
  "ok": false,
  "id": "request-id",
  "dryRun": true,
  "summary": "Live API operation failed",
  "error": {
    "code": "live_api_error",
    "message": "Could not resolve live_set tracks 0",
    "details": {}
  },
  "warnings": []
}
```

## Queueing And Response Flow

The bridge must serialize Live API operations.

Max Live API calls are stateful: a `live.path` object resolves an id, and a `live.object` then operates on that id. Running multiple requests through the same patch objects concurrently can mix ids and responses.

Flow:

1. CLI sends a validated request to `POST /requests`.
2. Node adapter assigns `bridgeRequestId`.
3. Node adapter adds the request to an in-memory FIFO queue.
4. If no request is active, the adapter sends the request to Max with `max-api.outlet`.
5. Max routes the request by `action`.
6. Max performs Live API reads/writes.
7. Max sends a normalized response back to Node.
8. Node resolves the pending HTTP response.
9. Node starts the next queued request.

Request timeout:

- If Max does not return before `SCENELAB_BRIDGE_REQUEST_TIMEOUT_MS`, Node returns `bridge_request_timeout`.
- The queue then advances.
- Timed-out Max responses should be ignored by `bridgeRequestId`.

## Live API Router

The Max side should route by action and use fixed subpatches per action group.

Recommended patchers:

- `p status`
- `p inspect_set`
- `p create_scene`
- `p create_midi_track`
- `p create_midi_clip`
- `p set_clip_notes`
- `p set_clip_name`
- `p set_device_parameter`

Use `dict` messages for structured request and response payloads between Node and Max.

Use `live.path` for path resolution:

- `live_set`
- `live_set tracks N`
- `live_set scenes N`
- `live_set tracks N clip_slots M`
- `live_set tracks N clip_slots M clip`
- `live_set tracks N devices D`
- `live_set tracks N devices D parameters P`

Use `live.object` for:

- `get` properties
- `set` properties
- `call` methods

Use `live.observer` only for later event subscriptions. V1 endpoints can be request/response without observation.

## First Supported Operations

### `status`

Return bridge and Live availability.

Data:

- bridge version
- host
- port
- Live Set reachable boolean
- current track count
- current scene count

Live API path:

- `live_set`

### `inspect_set`

Return tracks, scenes, and clip slot occupancy.

Live API paths:

- `live_set`
- `live_set tracks N`
- `live_set scenes N`
- `live_set tracks N clip_slots M`

Minimum fields:

- track index
- track id
- track name
- track type if available
- scene index
- scene id
- scene name if available
- clip slot occupied boolean
- clip id when present

### `create_scene`

Create a scene without deleting or overwriting existing scenes.

Expected Live API method:

- `call create_scene`

Parameters:

- optional index
- optional name

Post-step:

- resolve created scene
- set name if requested and supported
- return scene id and index

### `create_midi_track`

Create a MIDI track without deleting or overwriting existing tracks.

Expected Live API method:

- `call create_midi_track`

Parameters:

- optional index
- optional name

Post-step:

- resolve created track
- set name if requested
- return track id and index

### `create_midi_clip`

Create a MIDI clip in a clip slot.

Live API paths:

- `live_set tracks N clip_slots M`
- `live_set tracks N clip_slots M clip`

Expected Live API method:

- `call create_clip LENGTH`

Parameters:

- track index
- scene index
- clip length in beats
- optional clip name

Safety:

- If the target clip slot already contains a clip, return `clip_slot_occupied`.
- Do not overwrite clips in v1.

### `set_clip_notes`

Write MIDI notes to a clip created or selected by SceneLab.

Live API path:

- `live_set tracks N clip_slots M clip`

Expected Live API method family:

- Live 11 clip note mutation through `live.object` `call` messages.
- Implementation must verify the exact method sequence in Live 11 before closing the write ticket.

Parameters:

- track index
- scene index
- notes array
- note pitch
- start beat
- duration beats
- velocity
- mute flag

Safety:

- In v1, only write notes into clips created by the current request or clips explicitly identified in the request.
- Do not clear arbitrary existing note data unless a future request type explicitly supports that and confirms it.

### `set_device_parameter`

Set an exposed Ableton device or rack macro parameter.

Live API paths:

- `live_set tracks N devices D`
- `live_set tracks N devices D parameters P`

Expected Live API operation:

- `set value VALUE` on a parameter object

Parameters:

- track index
- device index or device name
- parameter index or parameter name
- value

Serum rule:

- For Serum and Serum 2, control saved Ableton Instrument Rack macros.
- Do not attempt to click or inspect the Serum UI.

## Dry-Run Handling

Dry-run requests should normally be handled by the CLI planner before reaching the bridge.

If a dry-run request reaches the bridge:

- inspect endpoints may execute
- mutation endpoints must not mutate Live
- mutation endpoints should return a plan summary and `dryRun: true`

## Error Codes

Initial bridge error codes:

- `bridge_not_ready`
- `bridge_request_timeout`
- `unknown_action`
- `invalid_bridge_request`
- `live_set_unreachable`
- `live_path_not_found`
- `live_api_error`
- `clip_slot_occupied`
- `unsupported_operation`

All errors must still return JSON in the SceneLab response shape.

## Packaging Layout

Planned files:

```text
max/
  SceneLab Bridge.amxd
  bridge-design.md
  node/
    scenelab-bridge.cjs
    package.json
    src/
      live-adapter.cjs
      server.cjs
```

The `.amxd` file is the release artifact. The Node adapter source should stay in git as normal text.

## Manual Bring-Up Sequence

1. Open Ableton Live 11 Suite.
2. Create or open a Live Set.
3. Drop `SceneLab Bridge.amxd` on a MIDI track.
4. Confirm the device shows the bridge as running on `127.0.0.1:31741`.
5. Run:

   ```sh
   printf '{"id":"status","action":"status","dryRun":true,"params":{}}' \
     | SCENELAB_BRIDGE_URL=http://127.0.0.1:31741 node packages/cli/dist/index.js
   ```

6. Confirm the CLI returns `ok: true`.
7. Run `inspect_set`.
8. Only after status and inspection pass, enable create-scene and create-track endpoints.

## Non-Goals For V1

- No direct VST-host control surface.
- No non-local network bridge.
- No delete operations.
- No overwriting existing clips.
- No background arrangement generation inside Max.
- No audio rendering or mastering loop inside the bridge.
