# SceneLab Architecture

SceneLab uses a layered architecture so the Ableton control logic can be tested and reused outside any single AI client.

```text
AI client / MCP client
  -> scenelab-mcp
    -> scenelab CLI
      -> localhost HTTP JSON bridge
        -> SceneLab Bridge.amxd
          -> Node for Max adapter
            -> Max live.path / live.object / live.observer
              -> Ableton Live API
```

## Components

### CLI

The `scenelab` CLI is the canonical interface. It accepts JSON on stdin, validates the request, calls the local bridge, and returns normalized JSON on stdout.

The CLI owns:

- request and response schemas
- dry-run behavior
- apply confirmation checks
- bridge client behavior
- library scanning
- template planning
- stable errors and warnings

### MCP Server

The MCP server is intentionally thin. It exposes agent-friendly tools, validates tool inputs, invokes the CLI, and returns the CLI result.

The MCP server must not duplicate Ableton logic. This keeps shell usage, tests, and MCP usage aligned.

### Local Bridge

The local bridge is a Node for Max adapter running from a Max for Live device. It exposes localhost HTTP JSON endpoints to the CLI.

The bridge owns:

- checking that Ableton is reachable
- inspecting tracks, scenes, clip slots, and devices
- creating non-destructive Live objects
- writing MIDI notes and clip names
- setting exposed device parameters and automation data where supported

### Max for Live Device

The Max for Live device is the only layer that directly touches Ableton Live. It should keep the visible device minimal and focus on reliable bridge behavior.

## V1 Bridge Transport

Use localhost HTTP JSON on `127.0.0.1`. HTTP is simple to debug with `curl`, easy for the CLI to call, and good enough for command-style arrangement edits.

WebSocket and OSC can be added later if SceneLab needs streaming events or low-latency performance gestures.

## VST Role

SceneLab does not use a VST as the Ableton control surface.

VSTs are controlled instruments or effects. For Serum and Serum 2, SceneLab should load saved Ableton Instrument Racks and automate exposed macros instead of trying to drive the plugin UI.

The rack naming and macro contract lives in [Serum Rack Macro Standard](serum-rack-standard.md).
