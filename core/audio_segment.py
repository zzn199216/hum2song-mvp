"""Extract a time range from an audio file before transcription (Studio segment convert v0)."""
from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Tuple, Union

logger = logging.getLogger(__name__)

MIN_SEGMENT_SEC = 1.0
MAX_SEGMENT_SEC = 3600.0


class SegmentValidationError(ValueError):
    """Raised when segment start/duration/end are invalid for the source audio."""


def clamp_segment(
    source_duration_sec: float,
    start_sec: float,
    duration_sec: float,
) -> Tuple[float, float]:
    """Clamp start/duration to [0, source_duration]."""
    total = max(0.0, float(source_duration_sec))
    start = max(0.0, float(start_sec))
    if start >= total:
        start = max(0.0, total - MIN_SEGMENT_SEC)
    dur = max(MIN_SEGMENT_SEC, min(float(duration_sec), MAX_SEGMENT_SEC))
    remaining = max(0.0, total - start)
    if remaining < MIN_SEGMENT_SEC:
        raise SegmentValidationError("segment extends past audio end")
    dur = min(dur, remaining)
    if dur < MIN_SEGMENT_SEC:
        raise SegmentValidationError("segment too short")
    return start, dur


def resolve_segment_params(
    *,
    source_duration_sec: Optional[float],
    segment_start_sec: Optional[float],
    segment_duration_sec: Optional[float],
    segment_end_sec: Optional[float],
) -> Optional[Tuple[float, float]]:
    """
    Return (start_sec, duration_sec) when any segment query param is set, else None.
    """
    has_any = (
        segment_start_sec is not None
        or segment_duration_sec is not None
        or segment_end_sec is not None
    )
    if not has_any:
        return None

    start = float(segment_start_sec or 0.0)
    if segment_duration_sec is not None and segment_end_sec is not None:
        raise SegmentValidationError("provide segment_duration_sec or segment_end_sec, not both")
    if segment_end_sec is not None:
        end = float(segment_end_sec)
        if end <= start:
            raise SegmentValidationError("segment_end_sec must be greater than segment_start_sec")
        duration = end - start
    elif segment_duration_sec is not None:
        duration = float(segment_duration_sec)
    else:
        duration = 30.0

    if source_duration_sec is not None and source_duration_sec > 0:
        return clamp_segment(source_duration_sec, start, duration)
    start = max(0.0, start)
    duration = max(MIN_SEGMENT_SEC, min(duration, MAX_SEGMENT_SEC))
    return start, duration


def probe_audio_duration_sec(path: Union[str, Path]) -> Optional[float]:
    """Best-effort duration in seconds (librosa, then ffprobe)."""
    in_path = Path(path)
    if not in_path.exists():
        return None
    try:
        import librosa

        return float(librosa.get_duration(path=str(in_path)))
    except Exception:
        pass
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return None
    try:
        proc = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(in_path),
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if proc.returncode != 0:
            return None
        return float(proc.stdout.strip())
    except Exception:
        return None


def extract_audio_segment(
    input_path: Union[str, Path],
    output_path: Union[str, Path],
    start_sec: float,
    duration_sec: float,
) -> Path:
    """
    Write ``duration_sec`` of audio starting at ``start_sec`` to ``output_path``.
    Prefers ffmpeg; falls back to librosa + soundfile.
    """
    in_path = Path(input_path)
    out_path = Path(output_path)
    if not in_path.exists():
        raise FileNotFoundError(f"input not found: {in_path}")

    start = max(0.0, float(start_sec))
    duration = max(MIN_SEGMENT_SEC, min(float(duration_sec), MAX_SEGMENT_SEC))
    out_path.parent.mkdir(parents=True, exist_ok=True)

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        cmd = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            f"{start:.6f}",
            "-i",
            str(in_path),
            "-t",
            f"{duration:.6f}",
            "-ac",
            "1",
            str(out_path),
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120, check=False)
            if proc.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0:
                logger.info(
                    "[H2S segment] ffmpeg extract start=%.3fs duration=%.3fs -> %s",
                    start,
                    duration,
                    out_path.name,
                )
                return out_path
            logger.warning(
                "[H2S segment] ffmpeg failed rc=%s stderr=%s",
                proc.returncode,
                (proc.stderr or "")[:200],
            )
        except Exception as e:
            logger.warning("[H2S segment] ffmpeg error: %s", e)

    import librosa
    import soundfile as sf

    from core.config import get_settings

    settings = get_settings()
    target_sr = int(settings.target_sample_rate)
    y, _sr = librosa.load(str(in_path), sr=target_sr, mono=True, offset=start, duration=duration)
    if y.size == 0:
        raise SegmentValidationError("extracted segment is empty")
    sf.write(str(out_path), y, target_sr)
    logger.info(
        "[H2S segment] librosa extract start=%.3fs duration=%.3fs -> %s",
        start,
        duration,
        out_path.name,
    )
    return out_path
