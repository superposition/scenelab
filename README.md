# SceneLab

SceneLab is a template-driven arrangement control system for Ableton Live.

The goal is to let AI tools and command-line workflows create and shape real Ableton sessions: scenes, tracks, clips, MIDI notes, arrangement templates, automation, sample-library choices, and Serum rack control.

SceneLab is not just a loop generator. It is designed for full arrangements, genre-aware templates, polyphonic writing, polyrhythm, odd meters, automation, mixing, and repeatable production workflows.

## Architecture

```text
MCP tool call
  -> scenelab CLI
    -> localhost HTTP bridge
      -> Max for Live device
        -> Ableton Live API
```

The CLI is the stable contract. MCP clients, shell scripts, and other tools should call the CLI instead of reimplementing Ableton logic.

The Max for Live device is the only layer that talks directly to Ableton Live. It owns Live API access through Max objects and a Node for Max adapter.

## V1 Direction

- Target Ableton Live 11 Suite first.
- Use Max for Live and Node for Max as the Live control surface.
- Use TypeScript for the CLI and MCP wrapper.
- Use localhost HTTP JSON between the CLI and the running bridge.
- Keep dry-run as the default for planned edits.
- Treat Serum and Serum 2 as controlled instruments through saved Ableton racks and mapped macros.
- Use the [Serum rack macro standard](docs/serum-rack-standard.md) for rack names, macro names, and template references.

## Safety Model

SceneLab should preview changes before applying them.

By default, CLI requests are dry runs. Applying changes requires both:

```json
{
  "dryRun": false,
  "confirm": "apply"
}
```

V1 should avoid destructive operations such as deleting tracks, deleting scenes, overwriting files, or rendering over existing audio.

## CLI Contract

Requests are JSON on stdin. Responses are JSON on stdout. Logs go to stderr.

Example request:

```json
{
  "id": "request-id",
  "action": "status",
  "dryRun": true,
  "params": {}
}
```

Example response:

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

## First Proof

The first musical proof is a city pop 6/8 arrangement template. It should create a structured Live set with scenes, tracks, MIDI clips, polyphonic harmony, bass motion, drum placeholders, and automation intent.

## Repo Layout

```text
docs/          Architecture and roadmap
max/           Max for Live bridge notes and device source
packages/cli/  JSON stdin/stdout CLI
packages/mcp/  Thin MCP wrapper around the CLI
templates/     Arrangement and groove template registry
```

The first manual Live proof is documented in [Manual Ableton V1 Acceptance Test](docs/acceptance/manual-ableton-v1.md).

## Status

SceneLab is at scaffold stage. The initial GitHub issues define the v1 implementation path.
