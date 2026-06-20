# Manual Ableton V1 Acceptance Test

This test proves what SceneLab can do from the CLI against Ableton Live 11 Suite.

It has two separate gates:

- Dry-run arrangement proof: the CLI can generate the city pop 6/8 plan without mutating Ableton.
- Live mutation proof: the CLI can reach the bridge and make confirmed, non-destructive Live changes.

Do not count dry-run output as Live mutation proof.

## Prerequisites

- Ableton Live 11 Suite with Max for Live.
- `SceneLab Bridge.amxd` available locally.
- A fresh or disposable Live Set.
- The repo built from the repo root:

```sh
npm install
npm run build
```

Set the bridge URL for the shell running the commands:

```sh
export SCENELAB_BRIDGE_URL=http://127.0.0.1:31741
```

## 1. Load The Bridge

1. Open Ableton Live 11 Suite.
2. Open a fresh or disposable Live Set.
3. Drop `SceneLab Bridge.amxd` onto a MIDI track.
4. Confirm the device reports the bridge on `127.0.0.1:31741`.

Expected result:

- The bridge is visibly loaded in Ableton.
- No SceneLab command has changed the set yet.

Failure signals:

- The device cannot be loaded.
- The bridge does not start.
- The device reports a port other than `31741` and `SCENELAB_BRIDGE_URL` was not updated.

## 2. Prove Bridge Status

Run:

```sh
printf '{"id":"manual-status","action":"status","dryRun":true,"params":{}}' \
  | node packages/cli/dist/index.js
```

Expected CLI result:

- `ok: true`
- `summary: "SceneLab bridge is running"`
- `data.bridge.host: "127.0.0.1"`
- `data.bridge.port: 31741`
- `data.live.liveSetReachable: true`

Failure signals:

- `bridge_unavailable`: the CLI cannot reach the bridge URL.
- `live_set_unreachable`: the bridge is running but cannot reach the Live set.
- Non-JSON stdout: the CLI contract is broken.

## 3. Prove Dry-Run City Pop Planning

Run:

```sh
printf '{"id":"manual-plan","action":"plan_arrangement","dryRun":true,"params":{"templateId":"city-pop-6-8"}}' \
  | node packages/cli/dist/index.js
```

Expected CLI result:

- `ok: true`
- `summary: "Planned City Pop 6/8 Proof"`
- `data.plan.dryRun: true`
- `data.plan.meter.numerator: 6`
- `data.plan.meter.denominator: 8`
- 6 scenes: Intro, Verse A, Pre-Chorus, Chorus, Bridge, Outro Vamp
- 7 tracks: drums, bass, keys, guitar, brass, strings, synth-lead
- 42 clips
- MIDI note data for drums, bass, keys, brass, strings, and synth lead
- automation intent for `synth-lead.cutoff` and `return.delay.send`

Expected Ableton result:

- No scenes, tracks, clips, notes, names, or automation are changed by this step.

Failure signals:

- The plan is 4/4.
- Scene or clip counts are missing.
- The CLI mutates Ableton during `dryRun: true`.
- Automation intent is absent from the plan.

## 4. Check Full-Plan Apply Gate

Run the full-plan apply command with explicit confirmation:

```sh
printf '{"id":"manual-apply-plan","action":"apply_plan","dryRun":false,"confirm":"apply","params":{"templateId":"city-pop-6-8"}}' \
  | node packages/cli/dist/index.js
```

Current expected result:

- Full `apply_plan` is not accepted as the Live mutation proof until it returns `ok: true` and the Live set reflects the planned scenes, tracks, clips, names, notes, and automation intent.
- In the current scaffold, an unsupported or not-implemented response is an expected failure signal for the full-plan apply gate.

Future pass criteria:

- Ableton contains the six planned section scenes.
- Ableton contains the seven planned role tracks.
- Planned MIDI clips exist in the matching scene and track slots.
- Clip names match the plan.
- Notes match the planned 6/8 beat positions and lengths.
- Automation lanes are written or the response includes explicit warnings for unsupported automation writes.

## 5. Prove Confirmed Live Mutation With Supported Writes

These commands prove the bridge can mutate Ableton through explicit confirmation. Use a disposable set because the commands insert a scene, a MIDI track, and a MIDI clip.

Create an acceptance scene at index 0:

```sh
printf '{"id":"manual-create-scene","action":"create_scene","dryRun":false,"confirm":"apply","params":{"index":0,"name":"SceneLab Acceptance Intro"}}' \
  | node packages/cli/dist/index.js
```

Create an acceptance MIDI track at index 0:

```sh
printf '{"id":"manual-create-track","action":"create_midi_track","dryRun":false,"confirm":"apply","params":{"index":0,"name":"SceneLab Acceptance Keys"}}' \
  | node packages/cli/dist/index.js
```

Create a 6/8 MIDI clip in the new track and scene:

```sh
printf '{"id":"manual-create-clip","action":"create_midi_clip","dryRun":false,"confirm":"apply","params":{"trackIndex":0,"sceneIndex":0,"lengthBeats":6,"name":"SceneLab Acceptance Keys"}}' \
  | node packages/cli/dist/index.js
```

Rename the clip:

```sh
printf '{"id":"manual-name-clip","action":"set_clip_name","dryRun":false,"confirm":"apply","params":{"trackIndex":0,"sceneIndex":0,"name":"SceneLab Acceptance Keys 6/8"}}' \
  | node packages/cli/dist/index.js
```

Write a three-note chord:

```sh
printf '{"id":"manual-set-notes","action":"set_clip_notes","dryRun":false,"confirm":"apply","params":{"trackIndex":0,"sceneIndex":0,"notes":[{"pitch":60,"startBeat":0,"durationBeats":1.5,"velocity":96},{"pitch":64,"startBeat":0,"durationBeats":1.5,"velocity":92},{"pitch":67,"startBeat":0,"durationBeats":1.5,"velocity":90}]}}' \
  | node packages/cli/dist/index.js
```

Expected CLI result for each command:

- `ok: true`
- `dryRun: false`
- The summary names the write that happened.

Expected Ableton result:

- A scene named `SceneLab Acceptance Intro` exists.
- A MIDI track named `SceneLab Acceptance Keys` exists.
- A MIDI clip named `SceneLab Acceptance Keys 6/8` exists at track index 0, scene index 0.
- The clip length is 6 beats.
- The clip contains C, E, and G notes starting at beat 0.

Failure signals:

- Any confirmed write returns `missing_apply_confirmation`.
- Any confirmed write returns `clip_slot_occupied`; use a fresh set or a different empty slot.
- The CLI returns a dry-run response for a command with `dryRun: false`.
- Ableton does not visually reflect the successful CLI response.

## 6. Inspect The Mutated Set

Run:

```sh
printf '{"id":"manual-inspect","action":"inspect_set","dryRun":true,"params":{}}' \
  | node packages/cli/dist/index.js
```

Expected CLI result:

- `ok: true`
- `summary: "SceneLab inspected the Live set"`
- The first track is `SceneLab Acceptance Keys`.
- The first scene is `SceneLab Acceptance Intro`.
- The first clip slot has a clip named `SceneLab Acceptance Keys 6/8`.

Expected Ableton result:

- Ableton matches the inspected JSON.

## Recording The Result

Record this with the test run:

```text
Date:
Commit:
Ableton Live version:
macOS version:
Bridge URL:
Dry-run arrangement proof: pass/fail
Full-plan apply gate: pass/fail/not implemented
Confirmed Live mutation proof: pass/fail
Notes:
```

The V1 acceptance test passes only when dry-run planning and confirmed Live mutation both pass. Full-plan apply remains a separate gate until `apply_plan` maps plans into confirmed bridge writes.
