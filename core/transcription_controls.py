from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from core.score_models import NoteEvent, ScoreDoc

TRANSCRIPTION_TARGETS = (
    "auto",
    "ai_full_mix",
    "melody",
    "chords",
    "vocal_humming",
    "piano_guitar",
    "electronic_melody",
    "pad_chords",
)


@dataclass(frozen=True)
class TranscriptionControls:
    transcription_target: str = "auto"
    cleanup_strength: int = 50
    preserve_raw_candidates: bool = False


@dataclass(frozen=True)
class BasicPitchInferenceParams:
    onset_threshold: float
    frame_threshold: float
    minimum_note_length_ms: float


def normalize_transcription_target(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    aliases = {
        "": "auto",
        "default": "auto",
        "synth_lead": "electronic_melody",
        "synth_pad": "pad_chords",
    }
    normalized = aliases.get(normalized, normalized)
    return normalized if normalized in TRANSCRIPTION_TARGETS else "auto"


def normalize_cleanup_strength(value: Any) -> int:
    try:
        parsed = round(float(value))
    except (TypeError, ValueError):
        return 50
    return max(0, min(100, int(parsed)))


def normalize_preserve_raw_candidates(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value == 1
    return str(value or "").strip().lower() in {"1", "true", "yes"}


def normalize_transcription_controls(value: Mapping[str, Any] | None = None) -> TranscriptionControls:
    source = value or {}
    return TranscriptionControls(
        transcription_target=normalize_transcription_target(
            source.get("transcription_target", source.get("transcriptionTarget"))
        ),
        cleanup_strength=normalize_cleanup_strength(
            source.get("cleanup_strength", source.get("cleanupStrength", 50))
        ),
        preserve_raw_candidates=normalize_preserve_raw_candidates(
            source.get("preserve_raw_candidates", source.get("preserveRawCandidates", False))
        ),
    )


def resolve_basic_pitch_params(
    controls: TranscriptionControls,
    *,
    default_onset_threshold: float,
    default_frame_threshold: float,
    default_minimum_note_length_ms: float = 50.0,
) -> BasicPitchInferenceParams:
    target = controls.transcription_target
    if target == "auto":
        return BasicPitchInferenceParams(
            onset_threshold=float(default_onset_threshold),
            frame_threshold=float(default_frame_threshold),
            minimum_note_length_ms=float(default_minimum_note_length_ms),
        )
    presets = {
        "ai_full_mix": (0.42, 0.22),
        "melody": (0.42, 0.22),
        "vocal_humming": (0.42, 0.22),
        "chords": (0.38, 0.20),
        "piano_guitar": (0.45, 0.25),
        "electronic_melody": (0.40, 0.20),
        "pad_chords": (0.35, 0.18),
    }
    onset, frame = presets.get(target, (default_onset_threshold, default_frame_threshold))
    return BasicPitchInferenceParams(onset, frame, 50.0)


def _note_end(note: NoteEvent) -> float:
    return float(note.start) + float(note.duration)


def _clone_notes(notes: list[NoteEvent]) -> list[NoteEvent]:
    result: list[NoteEvent] = []
    for note in notes:
        cloned = note.model_copy(deep=True)
        result.append(cloned)
    return result


def _filter_tiny(notes: list[NoteEvent], minimum_sec: float) -> list[NoteEvent]:
    if minimum_sec <= 0:
        return _clone_notes(notes)
    return [note for note in _clone_notes(notes) if float(note.duration) >= minimum_sec]


def _merge_melody_fragments(notes: list[NoteEvent], gap_sec: float) -> list[NoteEvent]:
    ordered = sorted(_clone_notes(notes), key=lambda n: (float(n.start), -int(n.velocity), -float(n.duration)))
    merged: list[NoteEvent] = []
    for note in ordered:
        previous = merged[-1] if merged else None
        if (
            previous is not None
            and abs(int(previous.pitch) - int(note.pitch)) <= 1
            and float(note.start) <= _note_end(previous) + gap_sec
        ):
            previous_duration = float(previous.duration)
            end = max(_note_end(previous), _note_end(note))
            if float(note.duration) > previous_duration or int(note.velocity) > int(previous.velocity) + 8:
                previous.pitch = note.pitch
            previous.duration = end - float(previous.start)
            previous.velocity = max(int(previous.velocity), int(note.velocity))
        else:
            merged.append(note)
    return merged


def _reduce_melody_overlap(notes: list[NoteEvent], minimum_sec: float) -> list[NoteEvent]:
    ordered = sorted(_clone_notes(notes), key=lambda n: (float(n.start), -int(n.velocity), -float(n.duration)))
    output: list[NoteEvent] = []
    for note in ordered:
        previous = output[-1] if output else None
        if previous is None or float(note.start) >= _note_end(previous):
            output.append(note)
            continue
        if abs(float(note.start) - float(previous.start)) <= 0.02:
            if int(note.velocity) > int(previous.velocity) or (
                int(note.velocity) == int(previous.velocity) and float(note.duration) > float(previous.duration)
            ):
                output[-1] = note
            continue
        if int(note.velocity) > int(previous.velocity) + 5:
            previous.duration = float(note.start) - float(previous.start)
            if float(previous.duration) < minimum_sec:
                output.pop()
            output.append(note)
            continue
        end = _note_end(note)
        note.start = _note_end(previous)
        note.duration = end - float(note.start)
        if float(note.duration) >= minimum_sec:
            output.append(note)
    return output


def _snap_chord_onsets(notes: list[NoteEvent], tolerance_sec: float) -> list[NoteEvent]:
    ordered = sorted(_clone_notes(notes), key=lambda n: (float(n.start), int(n.pitch)))
    index = 0
    while index < len(ordered):
        anchor = float(ordered[index].start)
        end = index + 1
        while end < len(ordered) and float(ordered[end].start) - anchor <= tolerance_sec:
            end += 1
        for cursor in range(index, end):
            ordered[cursor].start = anchor
        index = end
    return ordered


def _merge_sustain(notes: list[NoteEvent], gap_sec: float) -> list[NoteEvent]:
    by_pitch: dict[int, list[NoteEvent]] = {}
    for note in _clone_notes(notes):
        by_pitch.setdefault(int(note.pitch), []).append(note)
    output: list[NoteEvent] = []
    for bucket in by_pitch.values():
        bucket.sort(key=lambda n: (float(n.start), -float(n.duration)))
        merged: list[NoteEvent] = []
        for note in bucket:
            previous = merged[-1] if merged else None
            if previous is not None and float(note.start) <= _note_end(previous) + gap_sec:
                end = max(_note_end(previous), _note_end(note))
                previous.duration = end - float(previous.start)
                previous.velocity = max(int(previous.velocity), int(note.velocity))
            else:
                merged.append(note)
        output.extend(merged)
    return sorted(output, key=lambda n: (float(n.start), int(n.pitch)))


def _chord_window_limit(cleanup_strength: int) -> int:
    if cleanup_strength >= 90:
        return 3
    if cleanup_strength >= 70:
        return 4
    if cleanup_strength >= 35:
        return 5
    return 6


def _cap_chord_windows(notes: list[NoteEvent], window_sec: float, max_notes: int) -> list[NoteEvent]:
    ordered = sorted(_clone_notes(notes), key=lambda n: (float(n.start), int(n.pitch)))
    output: list[NoteEvent] = []
    index = 0
    while index < len(ordered):
        anchor = float(ordered[index].start)
        end = index + 1
        while end < len(ordered) and float(ordered[end].start) - anchor <= window_sec:
            end += 1
        group = ordered[index:end]
        if len(group) <= max_notes:
            output.extend(group)
        else:
            bass = min(group, key=lambda note: int(note.pitch))
            ranked = sorted(
                group,
                key=lambda note: (-int(note.velocity), -float(note.duration), int(note.pitch)),
            )
            selected = ranked[:max_notes]
            if bass not in selected:
                selected[-1] = bass
            output.extend(sorted(selected, key=lambda note: int(note.pitch)))
        index = end
    return sorted(output, key=lambda n: (float(n.start), int(n.pitch)))


def _postprocess_notes(notes: list[NoteEvent], controls: TranscriptionControls) -> list[NoteEvent]:
    strength = controls.cleanup_strength / 100.0
    target = controls.transcription_target
    if controls.preserve_raw_candidates or target == "auto":
        return notes
    if target == "ai_full_mix":
        minimum = 0.0 if controls.cleanup_strength <= 35 else 0.02 + strength * 0.06
        return _filter_tiny(notes, minimum)
    if target in {"melody", "electronic_melody", "vocal_humming"}:
        minimum = 0.03 + strength * 0.12
        gap = 0.06 + strength * 0.08
        merged = _merge_melody_fragments(_filter_tiny(notes, minimum), gap)
        reduced = _reduce_melody_overlap(merged, minimum) if controls.cleanup_strength >= 20 else merged
        return _merge_melody_fragments(reduced, gap)
    if target in {"chords", "pad_chords"}:
        minimum = 0.08 + strength * 0.17 if target == "pad_chords" else 0.04 + strength * 0.12
        prepared = _filter_tiny(notes, minimum)
        if target == "pad_chords":
            for note in prepared:
                note.duration = max(float(note.duration), 0.2 + strength * 0.15)
        sustained = _merge_sustain(prepared, 0.04 + strength * 0.06)
        snap_sec = 0.04 + strength * 0.08 if target == "pad_chords" else 0.08 + strength * 0.07
        snapped = _snap_chord_onsets(sustained, snap_sec)
        if target == "pad_chords":
            return _merge_sustain(snapped, 0.08 + strength * 0.10)
        capped = _cap_chord_windows(snapped, snap_sec, _chord_window_limit(controls.cleanup_strength))
        return _merge_sustain(capped, 0.06 + strength * 0.08)
    if target == "piano_guitar":
        return _filter_tiny(notes, strength * 0.06)
    return notes


def postprocess_score(score: ScoreDoc, controls: TranscriptionControls) -> ScoreDoc:
    if controls.transcription_target == "auto" or controls.preserve_raw_candidates:
        return score
    output = score.model_copy(deep=True)
    for track in output.tracks:
        track.notes = _postprocess_notes(track.notes, controls)
        for note in track.notes:
            note.start = round(float(note.start), 6)
            note.duration = round(float(note.duration), 6)
    return output
