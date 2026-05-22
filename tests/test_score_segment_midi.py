from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
from music21 import note, stream  # type: ignore

import routers.score as score_router
from app import create_app
from core.models import FileType
from core.task_manager import task_manager


def _make_tiny_midi(p: Path) -> Path:
    s = stream.Stream()
    s.append(note.Note("C4", quarterLength=1.0))
    s.write("midi", fp=str(p))
    assert p.exists()
    return p


def test_score_reads_segment_suffixed_midi(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(score_router, "get_settings", lambda: SimpleNamespace(output_dir=tmp_path))

    app = create_app()
    tid = task_manager.create_task()
    audio = tmp_path / f"{tid}.mp3"
    audio.write_bytes(b"fake-audio")
    task_manager.mark_completed(tid, artifact_path=audio, file_type=FileType.audio)

    segment_midi = _make_tiny_midi(tmp_path / f"{tid}_segment.mid")

    with TestClient(app) as client:
        r = client.get(f"/tasks/{tid}/score")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "tracks" in data
        assert len(data["tracks"]) >= 1

    task_manager.attach_artifact(tid, artifact_path=segment_midi, file_type=FileType.midi)
    with TestClient(app) as client:
        r2 = client.get(f"/tasks/{tid}/score")
        assert r2.status_code == 200
