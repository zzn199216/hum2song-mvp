from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import routers.generation as gen_module
from app import app
from core.generation_service import GenerationService
from core.task_manager import TaskManager


@pytest.fixture()
def client(tmp_path, monkeypatch):
    tm = TaskManager()

    def runner(input_path: Path, _fmt: str) -> Path:
        out = tmp_path / f"produced.{_fmt}"
        out.write_bytes(b"FAKE_AUDIO")
        return out

    svc = GenerationService(task_manager=tm, base_dir=tmp_path, runner=runner)
    monkeypatch.setattr(gen_module, "task_manager", tm)
    monkeypatch.setattr(gen_module, "generation_service", svc)
    return TestClient(app)


def test_generate_with_segment_query_stores_task_segment(client):
    with patch("routers.generation.probe_audio_duration_sec", return_value=90.0):
        with patch("routers.generation.extract_audio_segment") as mock_extract:
            def _fake_extract(_inp, out, _start, _dur):
                p = Path(out)
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(b"WAV")
                return p

            mock_extract.side_effect = _fake_extract
            r = client.post(
                "/generate?output_format=mp3&segment_start_sec=12&segment_duration_sec=30",
                files={"file": ("a.wav", b"fake-wav", "audio/wav")},
            )
    assert r.status_code == 202
    tid = r.json()["task_id"]
    seg = gen_module.task_manager.get_transcription_segment(tid)
    assert seg == (12.0, 30.0)


def test_generate_invalid_segment_returns_400(client):
    with patch("routers.generation.probe_audio_duration_sec", return_value=0.4):
        r = client.post(
            "/generate?output_format=mp3&segment_start_sec=0&segment_duration_sec=30",
            files={"file": ("a.wav", b"fake-wav", "audio/wav")},
        )
    assert r.status_code == 400


def test_generate_long_segment_accepted(client):
    with patch("routers.generation.probe_audio_duration_sec", return_value=180.4):
        with patch("routers.generation.extract_audio_segment") as mock_extract:
            def _fake_extract(_inp, out, start, dur):
                p = Path(out)
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_bytes(b"WAV")
                assert start == pytest.approx(0.0)
                assert dur == pytest.approx(180.3958125, abs=0.01)
                return p

            mock_extract.side_effect = _fake_extract
            r = client.post(
                "/generate?output_format=mp3&segment_start_sec=0&segment_duration_sec=180.3958125",
                files={"file": ("a.wav", b"fake-wav", "audio/wav")},
            )
    assert r.status_code == 202
