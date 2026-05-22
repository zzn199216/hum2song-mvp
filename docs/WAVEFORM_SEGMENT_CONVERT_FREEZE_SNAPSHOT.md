# Waveform segment convert — freeze snapshot

**Date:** 2026-05-23  
**Git:** `8222b7c` (branch `cloud-hosted`)  
**Static cache-bust:** `waveform-editor-v2` (`static/pianoroll/studio_asset_version.js`)

## What this freeze includes

- Audio clip **waveform segment editor** modal (`static/pianoroll/ui/audio_waveform_editor.js`).
- **Convert selected segment** via `POST /generate?segment_start_sec=…` → poll task → `GET /tasks/{id}/score` (Studio in-process Basic Pitch; **not** Cloud Worker).
- **Segment pipeline task id fix:** `run_pipeline(..., contract_task_id=…)` so MIDI lands at `{task_id}.mid` (not `{task_id}_segment.mid`).
- **Score fetch:** fallback `{task_id}_segment.mid`; safe `errorCode` / `phase` on task errors and 409 score responses.
- **Waveform UX:** conversion phases, Chinese failure messages, retry button, status sync in modal.
- **Production deploy (aliyun-music-core):** release `8222b7c`, `hum2song-studio.service` active.

## What is explicitly NOT included (deferred)

- Cloud Worker deployment or routing Studio convert through Worker.
- Basic Pitch startup warmup (`H2S_BASIC_PITCH_WARMUP=1`) — optional later.
- Spectrogram / pitch-contour waveform overlays.
- Further latency optimization beyond current pipeline.

## Verification (lightweight)

```bash
node scripts/tests/ui_audio_waveform_editor.test.js
node scripts/tests/audio_convert_segment.test.js
node scripts/tests/audio_convert_status.test.js
pytest tests/test_audio_segment.py tests/test_generate_segment_api.py tests/test_score_segment_midi.py tests/test_pipeline_contract_task.py -q
```

## Manual smoke

1. Open audio clip → waveform modal loads.
2. Select segment → convert → completes or shows safe failure + retry.
3. Original audio clip unchanged on timeline.

## Cloud embed note

Hum2Song Cloud iframe should set `NEXT_PUBLIC_H2S_OSS_STUDIO_VERSION=8222b7c` (or rely on Studio static `waveform-editor-v2`) so embed does not serve pre-waveform JS (`msg.audioClipNoEditor`).
