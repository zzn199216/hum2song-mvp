from core.score_models import NoteEvent, ScoreDoc, Track
from core.transcription_controls import (
    TranscriptionControls,
    postprocess_score,
    resolve_basic_pitch_params,
)


def _score(*notes: NoteEvent) -> ScoreDoc:
    return ScoreDoc(tracks=[Track(id="t1", name="Basic Pitch", notes=list(notes))])


def test_default_controls_preserve_existing_result_and_thresholds():
    controls = TranscriptionControls()
    params = resolve_basic_pitch_params(
        controls,
        default_onset_threshold=0.5,
        default_frame_threshold=0.3,
        default_minimum_note_length_ms=50,
    )
    assert params.onset_threshold == 0.5
    assert params.frame_threshold == 0.3
    assert params.minimum_note_length_ms == 50
    source = _score(NoteEvent(pitch=60, start=0, duration=0.04, velocity=70))
    assert postprocess_score(source, controls) is source


def test_ai_full_mix_preserves_short_and_overlapping_candidates_at_default_strength():
    controls = TranscriptionControls(transcription_target="ai_full_mix", cleanup_strength=25)
    source = _score(
        NoteEvent(pitch=36, start=0, duration=0.04, velocity=60),
        NoteEvent(pitch=60, start=0, duration=0.5, velocity=80),
        NoteEvent(pitch=67, start=0.01, duration=0.48, velocity=76),
    )
    output = postprocess_score(source, controls)
    assert len(output.tracks[0].notes) == 3


def test_melody_target_reduces_overlapping_notes():
    controls = TranscriptionControls(transcription_target="melody", cleanup_strength=75)
    source = _score(
        NoteEvent(id="lead-a", pitch=60, start=0, duration=0.6, velocity=90),
        NoteEvent(id="overlap", pitch=64, start=0.01, duration=0.5, velocity=55),
        NoteEvent(id="lead-b", pitch=67, start=0.3, duration=0.4, velocity=95),
    )
    output = postprocess_score(source, controls)
    notes = output.tracks[0].notes
    assert len(notes) < len(source.tracks[0].notes)
    assert all(note.id for note in notes)
    assert all(
        notes[index].start >= notes[index - 1].start + notes[index - 1].duration
        for index in range(1, len(notes))
    )


def test_preserve_raw_candidates_skips_aggressive_cleanup():
    controls = TranscriptionControls(
        transcription_target="melody",
        cleanup_strength=100,
        preserve_raw_candidates=True,
    )
    source = _score(
        NoteEvent(pitch=60, start=0, duration=0.04, velocity=70),
        NoteEvent(pitch=64, start=0, duration=0.4, velocity=60),
    )
    assert postprocess_score(source, controls) is source


def test_chord_target_keeps_polyphony_and_snaps_nearby_onsets():
    controls = TranscriptionControls(transcription_target="chords", cleanup_strength=50)
    output = postprocess_score(
        _score(
            NoteEvent(pitch=60, start=1, duration=0.8, velocity=80),
            NoteEvent(pitch=64, start=1.06, duration=0.8, velocity=78),
            NoteEvent(pitch=67, start=1.2, duration=0.8, velocity=76),
        ),
        controls,
    )
    notes = output.tracks[0].notes
    assert len(notes) == 3
    assert notes[0].start == notes[1].start
    assert notes[1].start != notes[2].start


def test_chord_outline_caps_dense_onset_windows_without_collapsing_polyphony():
    controls = TranscriptionControls(transcription_target="chords", cleanup_strength=50)
    source = _score(
        *[
            NoteEvent(
                pitch=pitch,
                start=index * 0.01,
                duration=0.6,
                velocity=90 - index,
            )
            for index, pitch in enumerate([36, 48, 55, 60, 64, 67, 71, 74])
        ]
    )
    notes = postprocess_score(source, controls).tracks[0].notes
    assert len(notes) == 5
    assert len(notes) >= 3
    assert all(note.start == 0 for note in notes)
    assert any(note.pitch == 36 for note in notes)
