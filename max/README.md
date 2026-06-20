# SceneLab Max Bridge

`SceneLab Bridge.amxd` is the Max for Live device that connects SceneLab to Ableton Live.

The implementation target is documented in [bridge-design.md](bridge-design.md).

## Responsibilities

- Run a Node for Max adapter.
- Expose localhost HTTP JSON endpoints to the CLI.
- Use Max Live API objects for Ableton control.
- Inspect tracks, scenes, clip slots, and devices.
- Create scenes, tracks, clips, MIDI notes, and clip names.
- Write safe automation or parameter changes where supported.

## V1 Constraints

- Target Ableton Live 11 Suite first.
- Keep writes non-destructive.
- Avoid delete operations.
- Return structured errors and warnings.
- Keep direct Ableton access inside this layer only.

## Serum

Serum and Serum 2 should be controlled through saved Ableton Instrument Racks with mapped macros. SceneLab should automate rack macros rather than attempting to drive the Serum UI directly.
