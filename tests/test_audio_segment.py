import numpy as np
import pytest
import soundfile as sf
from pathlib import Path

from core.audio_segment import (
    SegmentValidationError,
    clamp_segment,
    extract_audio_segment,
    resolve_segment_params,
)


def test_resolve_segment_defaults_duration():
    seg = resolve_segment_params(
        source_duration_sec=120.0,
        segment_start_sec=10.0,
        segment_duration_sec=None,
        segment_end_sec=None,
    )
    assert seg == (10.0, 30.0)


def test_resolve_segment_end_sec():
    seg = resolve_segment_params(
        source_duration_sec=90.0,
        segment_start_sec=5.0,
        segment_duration_sec=None,
        segment_end_sec=35.0,
    )
    assert seg == (5.0, 30.0)


def test_resolve_segment_both_duration_and_end_rejected():
    with pytest.raises(SegmentValidationError):
        resolve_segment_params(
            source_duration_sec=90.0,
            segment_start_sec=0.0,
            segment_duration_sec=10.0,
            segment_end_sec=20.0,
        )


def test_clamp_segment_past_end():
    start, dur = clamp_segment(87.77, 80.0, 30.0)
    assert start == pytest.approx(80.0, abs=0.01)
    assert dur == pytest.approx(7.77, abs=0.01)


def test_extract_audio_segment_writes_wav(tmp_path):
    sr = 22050
    t = np.linspace(0, 3.0, int(sr * 3), endpoint=False)
    y = (np.sin(2 * np.pi * 440 * t) * 0.2).astype(np.float32)
    src = tmp_path / "src.wav"
    out = tmp_path / "seg.wav"
    sf.write(str(src), y, sr)

    extract_audio_segment(src, out, start_sec=1.0, duration_sec=1.5)
    assert out.exists()
    seg, sr_out = sf.read(str(out))
    assert sr_out == sr
    assert seg.ndim == 1 or seg.shape[1] == 1
    got_dur = len(seg) / sr
    assert 1.3 <= got_dur <= 1.7
