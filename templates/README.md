# SceneLab Templates

Templates describe musical intent, arrangement structure, groove, harmony, instrumentation, automation, and asset expectations.

Templates are data first. The CLI should be able to plan from templates without Ableton running, then apply a validated plan when the bridge is available.

## Template Families

- Arrangement templates: full song structures and scene maps.
- Groove templates: meter, swing, tuplets, polyrhythm, polymeter, and humanization.
- Harmony templates: chord movement, extensions, inversions, modulations, and voice-leading rules.
- Track templates: roles, routing expectations, default devices, and bus relationships.
- Sound palette templates: samples, racks, Serum presets, Drum Racks, and Ableton devices.
- Automation templates: macro movement, filter sweeps, send throws, mutes, and tension curves.
- Mix templates: levels, bus processing, sidechain relationships, EQ zones, and width rules.

## V0 Seed

The first complete template should be `city-pop-6-8`, because it proves non-4/4 arrangement behavior, harmony, polyphony, and full-song form.

Other seed families:

- drum and bass
- jazz
- rock
- modern pop

The v0 seed arrangement templates live in:

```text
templates/arrangements/
```

Current seeds:

- `city-pop-6-8`
- `drum-and-bass-174`
- `jazz-swing-140`
- `modern-pop-96`
- `rock-anthem-128`

## Data Model

Each template is a JSON file with `schemaVersion: 1` and `type: "arrangement"`.

Required top-level fields:

- `id`: kebab-case stable id.
- `name` and `description`: readable labels for review and UI.
- `genreFamily`: one of `drum-and-bass`, `jazz`, `rock`, `city-pop`, or `modern-pop`.
- `meter`: numerator, denominator, feel, and optional subdivisions.
- `tempoRange`: `minBpm`, `maxBpm`, and `defaultBpm`.
- `harmony`: key center, mode, harmonic language, movement, and voice-leading intent.
- `rhythm`: groove, humanization, and role-based rhythmic patterns.
- `instrumentation`: track roles, names, types, required flags, and sound intent.
- `arrangementRoles`: ordered sections with bar counts, energy, and section roles.
- `energyCurve`: section-linked energy points.
- `assets`: expected racks, samples, and missing-asset warnings.
- `automation`: planned automation lanes and target sections.
- `mix`: headroom, buses, and mix expectations.

The parser lives in `packages/cli/src/templates.ts`. It validates every seed during tests and reports file paths plus schema paths for invalid templates.

## Adding Templates

1. Add a readable JSON file under `templates/arrangements/`.
2. Use a stable kebab-case `id`; filenames should match the id.
3. Keep musical intent explicit enough for a contributor to review without Ableton.
4. Reference assets by role and name, but mark producer-specific racks or samples as `required: false` until the library indexer can prove they exist.
5. Run:

```sh
npm test --workspace @scenelab/cli
```

Invalid templates fail with the source file and schema path that need attention.

## Serum Rack References

Serum and Serum 2 references must point at saved Ableton Instrument Racks, not plugin UI state. Use the rack names, macro display names, automation target ids, and missing-rack warnings from [Serum Rack Macro Standard](../docs/serum-rack-standard.md).

Template authors should keep the template `role` stable even when choosing a style-specific rack name. For example, `role: "synth-lead"` can reference `SceneLab Serum Lead`, `SceneLab Serum Smooth Lead`, or a matching `SceneLab Serum 2 ...` rack as long as the macro contract is identical.
