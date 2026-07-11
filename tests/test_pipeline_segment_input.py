from __future__ import annotations

from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import pytest

from core.pipeline import run_pipeline_for_task
from core.task_manager import TaskManager


@pytest.fixture()
def pipeline_dirs(tmp_path, monkeypatch):
    upload_dir = tmp_path / "uploads"
    output_dir = tmp_path / "outputs"
    upload_dir.mkdir(parents=True)
    output_dir.mkdir(parents=True)

    settings = type(
        "S",
        (),
        {
            "upload_dir": upload_dir,
            "output_dir": output_dir,
            "max_audio_seconds": 30,
            "max_upload_size_mb": 10,
            "target_sample_rate": 22050,
            "stem_separation_backend": "stub",
        },
    )()

    monkeypatch.setattr("core.pipeline.get_settings", lambda: settings)
    monkeypatch.setattr("core.pipeline.contract_task_manager", TaskManager())
    return upload_dir, output_dir


def test_run_pipeline_for_task_uses_segment_sidecar_and_duration(pipeline_dirs):
    upload_dir, output_dir = pipeline_dirs
    contract_id = str(uuid4())
    tm = TaskManager()
    contract_id = str(tm.create_task())
    tm.set_transcription_segment(contract_id, start_sec=0.0, duration_sec=180.3958125)

    segment_wav = upload_dir / f"{contract_id}_segment.wav"
    segment_wav.write_bytes(b"WAV")

    seen = {}

    def fake_preprocess(input_path, output_dir=None, *, load_max_sec=None):
        seen["input"] = Path(input_path)
        seen["load_max_sec"] = load_max_sec
        out = Path(output_dir or input_path.parent) / f"{Path(input_path).stem}_clean.wav"
        out.write_bytes(b"CLEAN")
        return out

    def fake_audio_to_midi(clean_wav, output_dir=None):
        out = Path(output_dir or output_dir) / f"{contract_id}.mid"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(b"MID")
        return out

    def fake_midi_to_audio(midi_path, output_dir=None, **kwargs):
        out = Path(output_dir) / f"{contract_id}.mp3"
        out.write_bytes(b"MP3")
        return out

    with patch("core.pipeline.contract_task_manager", tm):
        with patch("core.audio_preprocess.preprocess_audio", side_effect=fake_preprocess):
            with patch("core.ai_converter.audio_to_midi", side_effect=fake_audio_to_midi):
                with patch("core.synthesizer.midi_to_audio", side_effect=fake_midi_to_audio):
                    run_pipeline_for_task(
                        task_id=contract_id,
                        input_filename=segment_wav.name,
                        output_format="mp3",
                        cleanup_uploads=False,
                    )

    assert seen["input"] == segment_wav.resolve()
    assert seen["load_max_sec"] == pytest.approx(180.3958125)
