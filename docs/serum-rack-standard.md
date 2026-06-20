# Serum Rack Macro Standard

SceneLab controls Serum and Serum 2 through Ableton Instrument Racks. Templates should reference saved racks and automate rack macros, not plugin UI controls.

## Why Rack Macros

Ableton exposes rack macros through the Live API in a stable way. Serum and Serum 2 plugin windows, skins, parameter ordering, and UI state are not a reliable automation surface for an agent.

The standard control path is:

```text
SceneLab template role
  -> saved Ableton Instrument Rack
    -> exposed rack macro
      -> mapped Serum or Serum 2 parameter
```

## Rack Names

Save rack files in the Ableton User Library under:

```text
Presets/Instruments/SceneLab/Serum/
```

Use these rack names for template references:

| Template role | Serum rack name | Serum 2 rack name |
| --- | --- | --- |
| `bass` | `SceneLab Serum Bass` | `SceneLab Serum 2 Bass` |
| `synth-lead` | `SceneLab Serum Lead` | `SceneLab Serum 2 Lead` |
| `synth-lead` | `SceneLab Serum Smooth Lead` | `SceneLab Serum 2 Smooth Lead` |
| `pad` | `SceneLab Serum Pad` | `SceneLab Serum 2 Pad` |
| `pluck` | `SceneLab Serum Pluck` | `SceneLab Serum 2 Pluck` |
| `keys` | `SceneLab Serum Keys` | `SceneLab Serum 2 Keys` |
| `arp` | `SceneLab Serum Arp` | `SceneLab Serum 2 Arp` |
| `fx` | `SceneLab Serum FX` | `SceneLab Serum 2 FX` |

Serum 2 racks must keep the same macro names as Serum racks. Template authors can choose either rack name, but they should keep the `role` stable.

## Macro Names

Use these exact Ableton macro display names. Keep the order stable so racks are quick to audit.

| Macro | Display name | Template target id | Purpose |
| --- | --- | --- | --- |
| 1 | `Cutoff` | `cutoff` | Main filter cutoff movement. |
| 2 | `Resonance` | `resonance` | Main filter resonance. |
| 3 | `Wavetable Position` | `wavetable-position` | Primary oscillator wavetable position. |
| 4 | `Drive` | `drive` | Filter, distortion, or rack-level drive. |
| 5 | `Attack` | `attack` | Amp envelope attack. |
| 6 | `Decay` | `decay` | Amp envelope decay. |
| 7 | `Sustain` | `sustain` | Amp envelope sustain. |
| 8 | `Release` | `release` | Amp envelope release. |
| 9 | `LFO Rate` | `lfo-rate` | Main rhythmic modulation rate. |
| 10 | `LFO Depth` | `lfo-depth` | Main rhythmic modulation amount. |
| 11 | `Sub Level` | `sub-level` | Sub oscillator or low-layer level. |
| 12 | `Reverb Send` | `reverb-send` | Rack or return reverb amount. |
| 13 | `Delay Send` | `delay-send` | Rack or return delay amount. |

Template automation targets use the track role plus the target id:

```text
synth-lead.cutoff
bass.sub-level
pad.reverb-send
```

## Producer Setup Checklist

1. Create an Ableton Instrument Rack around Serum or Serum 2.
2. Save the rack under `Presets/Instruments/SceneLab/Serum/`.
3. Name the rack with one of the standard names above.
4. Map every required macro using the exact display names above.
5. Keep macro ranges musical and non-destructive. For example, `Cutoff` should sweep a useful range without muting the patch at either extreme.
6. Add a default Macro Variation named `Init`.
7. Run `scan_library` and confirm the rack appears as type `rack` with tags such as `serum`, the role name, and `macro-ready`.
8. Reference the exact rack name from template `assets.racks`.

## Template Authoring

Template rack references should use a stable role, exact rack name, and macro-ready tags:

```json
{
  "role": "synth-lead",
  "name": "SceneLab Serum Smooth Lead",
  "required": false,
  "tags": ["serum", "lead", "macro-ready"]
}
```

Use `required: false` for producer-specific color racks. Use `required: true` only when applying the template would be musically invalid without that rack.

## Missing Rack Warnings

Missing Serum racks should be visible in the dry-run plan before any write happens.

For optional racks, keep the plan usable and include a warning:

```json
{
  "code": "serum_rack_missing_optional",
  "message": "Optional Serum rack is not indexed; using a placeholder macro-ready instrument.",
  "details": {
    "role": "synth-lead",
    "name": "SceneLab Serum Smooth Lead",
    "tags": ["serum", "lead", "macro-ready"]
  }
}
```

For required racks, keep the dry-run plan readable but block apply until the rack is indexed:

```json
{
  "code": "serum_rack_missing_required",
  "message": "Required Serum rack is not indexed; apply is blocked until the rack is available.",
  "details": {
    "role": "bass",
    "name": "SceneLab Serum Bass",
    "tags": ["serum", "bass", "macro-ready"]
  }
}
```

The warning must include the role, rack name, and tags so producers know what to create or rename.
