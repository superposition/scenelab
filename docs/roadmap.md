# SceneLab Roadmap

## Goal

Build an Ableton workflow where an AI agent can move through reusable templates for songs, full arrangements, genre workflows, sound palettes, automation, mixing, and mastering.

The system must not assume all music is simple 4/4 loop-based production. It should support polyphonic writing, polyrhythm, odd meters, syncopation, humanized timing, and arrangement-level development across electronic, jazz, rock, city pop, and modern pop contexts.

## Core Template Types

- Song idea templates for mood, genre, tempo range, reference feel, harmonic language, and production constraints.
- Full arrangement templates for intro, verse, pre-chorus, chorus, bridge, solo, breakdown, drop, outro, reprise, and alternate forms.
- Scene templates for Session View rows that represent song sections, energy states, transitions, fills, and variations.
- Track templates for drums, bass, keys, guitar, brass, strings, pads, lead synths, vocals, FX, returns, and buses.
- Sound palette templates for sample packs, Serum racks, drum racks, Ableton devices, external plugins, and saved rack chains.
- Automation templates for filter movement, send throws, risers, tape stops, mutes, volume rides, macro morphs, and arrangement tension curves.
- Mix templates for routing, gain staging, bus processing, sidechain relationships, EQ zones, width rules, and return-track treatment.
- Master/check templates for loudness targets, headroom, mono low-end checks, reference comparisons, and render analysis.

## Genre Families

- Drum and bass: breakbeat chopping, ghost notes, half-time and double-time variants, Reese/sub bass, bass fills, and 16/32/64-bar energy maps.
- Jazz: swing and straight-eighth variants, ii-V-I, modal, blues, rhythm changes, extended harmony, comping, walking bass, solos, and trading sections.
- Rock: verse/chorus/bridge forms, live-band track layouts, drum fills, guitar layers, bass lock-in, dynamic chorus lifts, breakdowns, solos, and outros.
- City pop: extended harmony, secondary dominants, borrowed chords, smooth modulations, tight drums, bass, electric piano, brass, strings, guitar, synth layers, hooks, breaks, and outro vamps.
- Modern pop: hybrid acoustic/electronic drums, sparse-to-dense transitions, asymmetrical phrases, metric shifts, syncopated hooks, and non-obvious topline support.

## Rhythm Requirements

- Support meters beyond 4/4: 3/4, 5/4, 6/8, 7/8, 9/8, 12/8, and mixed meter.
- Support polymeter with independent loop lengths across drums, bass, harmony, and melody.
- Support polyrhythm such as 3-over-2, 4-over-3, 5-over-4, clave-derived patterns, and tuplets.
- Support swing, shuffle, pushed and pulled timing, late snares, early hats, and humanized velocities.
- Represent groove templates separately from note templates so one rhythm feel can be applied to multiple genres.

## Harmony And Melody Requirements

- Encode harmonic templates, not just chord lists.
- Support extended chords, inversions, slash chords, modal interchange, passing chords, borrowed chords, pedal tones, and modulation.
- Support polyphonic writing: counterlines, inner voices, bass motion, pads, comping, and lead melody as separate editable layers.
- Add voice-leading rules so generated parts move musically.
- Add call-and-response templates for vocals, lead synth, brass, guitar, and drums.

## First Build Milestones

- Create the TypeScript CLI and request/response schemas.
- Add a fake bridge for CLI integration tests.
- Create the Max for Live bridge design.
- Implement status and set inspection.
- Implement scene, track, clip, and MIDI note creation.
- Create the thin MCP wrapper around the CLI.
- Create template registry v0.
- Implement the city pop 6/8 proof template.
- Index Ableton User Library assets.
- Document Serum rack macro standards.
- Write the first manual Ableton acceptance test.

