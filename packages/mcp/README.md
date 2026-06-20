# SceneLab MCP

The MCP server is a thin wrapper around the SceneLab CLI.

It should expose agent-friendly tools while keeping all Ableton behavior in the CLI and bridge layers.

## Planned Tools

- `ableton_status`
- `scan_library`
- `plan_arrangement`
- `apply_arrangement`
- `create_clip`
- `load_rack`
- `write_automation`

Each tool should call the CLI with a JSON request and return the CLI response without inventing a separate behavior model.

