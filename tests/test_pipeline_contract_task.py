from __future__ import annotations

from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from core.pipeline import run_pipeline


def test_run_pipeline_uses_contract_task_id_for_segment_input(tmp_path, monkeypatch):
    contract_id = str(uuid4())
    upload_dir = tmp_path / "uploads"
    output_dir = tmp_path / "outputs"
    upload_dir.mkdir(parents=True)
    output_dir.mkdir(parents=True)

    segment_wav = upload_dir / f"{contract_id}_segment.wav"
    segment_wav.write_bytes(b"WAV")

    settings = type(
        "S",
        (),
        {"upload_dir": upload_dir, "output_dir": output_dir},
    )()

    def fake_run_pipeline_for_task(**kwargs):
        assert kwargs["task_id"] == contract_id
        out_mp3 = output_dir / f"{contract_id}.mp3"
        out_mid = output_dir / f"{contract_id}.mid"
        out_mp3.write_bytes(b"MP3")
        out_mid.write_bytes(b"MID")
        return None

    monkeypatch.setattr("core.pipeline.get_settings", lambda: settings)
    monkeypatch.setattr("core.pipeline.run_pipeline_for_task", fake_run_pipeline_for_task)

    out = run_pipeline(segment_wav, "mp3", contract_task_id=contract_id)
    assert out == output_dir / f"{contract_id}.mp3"
