# core/synthesizer.py
"""
音频合成模块 (Step 05) - Optimized Subprocess Version

功能：
- 接收 MIDI 文件 (.mid)
- 调用系统级命令 fluidsynth 将其渲染为 WAV（默认，最稳）
- (可选) 调用系统级命令 ffmpeg 将其转码为 MP3（严格模式：缺 ffmpeg 就报错）
- 具备清晰的错误输出（stdout/stderr 都保留）
- 支持 .env 指定 FLUIDSYNTH_PATH / SOUND_FONT_PATH
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path
from time import perf_counter
from typing import Optional, Union, Literal

from core.config import get_settings

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

AudioFormat = Literal["wav", "mp3"]


def _find_executable(name: str) -> Optional[str]:
    """跨平台寻找可执行文件（Windows 优先尝试 .exe）。"""
    cmd = shutil.which(name)
    if cmd:
        return cmd

    if os.name == "nt" and not name.lower().endswith(".exe"):
        cmd_exe = shutil.which(name + ".exe")
        if cmd_exe:
            return cmd_exe

    return None


def _get_fluidsynth_cmd() -> str:
    """
    获取 fluidsynth 路径，优先使用 config 指定的 FLUIDSYNTH_PATH。
    """
    settings = get_settings()

    if settings.fluidsynth_path:
        p = Path(settings.fluidsynth_path)
        if p.exists():
            return str(p)
        raise FileNotFoundError(f"FLUIDSYNTH_PATH 指向的文件不存在: {p}")

    cmd = _find_executable("fluidsynth")
    if cmd:
        return cmd

    raise FileNotFoundError(
        "未找到 fluidsynth 可执行文件。\n"
        "请确认已安装 FluidSynth 并加入 PATH，或在 .env 设置 FLUIDSYNTH_PATH=...\\fluidsynth.exe"
    )


def _ensure_soundfont_exists() -> Path:
    """
    确保 SoundFont 存在。若配置路径不存在，尝试在 assets 中寻找任意 .sf2 兜底。
    """
    settings = get_settings()
    sf2 = Path(settings.sound_font_path)

    if sf2.exists():
        return sf2

    candidates = list(settings.assets_dir.glob("*.sf2"))
    if candidates:
        logger.warning("⚠️ SOUND_FONT_PATH 不存在，自动使用 assets 中的: %s", candidates[0].name)
        return candidates[0]

    raise FileNotFoundError(
        f"SoundFont 缺失: {sf2}\n"
        "请下载 .sf2 文件放入 assets/，并在 .env 设置 SOUND_FONT_PATH=assets/piano.sf2"
    )


def _run_cmd(cmd: list[str], err_prefix: str) -> None:
    """
    统一运行命令并在失败时抛出包含 stdout/stderr 的异常。
    """
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        out = (e.stdout or "").strip()
        err = (e.stderr or "").strip()
        raise RuntimeError(
            f"{err_prefix}\n"
            f"CMD: {' '.join(cmd)}\n"
            f"STDOUT: {out}\n"
            f"STDERR: {err}"
        ) from e


def midi_to_audio(
    midi_path: Union[str, Path],
    output_dir: Optional[Union[str, Path]] = None,
    output_format: AudioFormat = "wav",  # ✅ 默认 WAV：最稳
    sample_rate: int = 44100,            # ✅ 播放兼容性更好
    gain: float = 0.6,                   # ✅ 更不容易爆音
    keep_wav: bool = False,              # mp3 时是否保留中间 wav
) -> Path:
    """
    核心合成函数：MIDI -> WAV / MP3
    """
    settings = get_settings()
    midi_path = Path(midi_path)

    if not midi_path.exists():
        raise FileNotFoundError(f"MIDI 文件不存在: {midi_path}")

    out_dir = Path(output_dir) if output_dir else Path(settings.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    sf2 = _ensure_soundfont_exists()
    fluidsynth = _get_fluidsynth_cmd()

    base_name = midi_path.stem
    wav_path = out_dir / f"{base_name}.wav"

    # 1) MIDI -> WAV
    cmd_synth = [
        fluidsynth,
        "-ni",
        "-g", str(gain),
        "-r", str(sample_rate),
        "-F", str(wav_path),
        str(sf2),
        str(midi_path),
    ]

    logger.info("🎼 [Synth] 渲染 MIDI -> WAV: %s", midi_path.name)
    logger.info("▶  %s", " ".join(cmd_synth))
    t_fs0 = perf_counter()
    _run_cmd(cmd_synth, err_prefix="FluidSynth 渲染失败")
    fluidsynth_ms = (perf_counter() - t_fs0) * 1000.0

    if not wav_path.exists() or wav_path.stat().st_size == 0:
        raise RuntimeError("FluidSynth 执行完成，但未生成有效 WAV 文件。")

    # 2) 若只要 WAV
    if output_format == "wav":
        logger.info(
            "[H2S timing] midi_to_audio fluidsynth_ms=%.1f ffmpeg_ms=0 output_format=wav",
            fluidsynth_ms,
        )
        logger.info("✅ [Synth] 输出完成: %s", wav_path.name)
        return wav_path

    # 3) WAV -> MP3（严格模式：缺 ffmpeg 就报错）
    ffmpeg = _find_executable("ffmpeg")
    if not ffmpeg:
        raise FileNotFoundError(
            "请求输出 MP3，但未找到 ffmpeg。\n"
            "请安装 ffmpeg 并加入 PATH，或改用 output_format='wav'。"
        )

    mp3_path = out_dir / f"{base_name}.mp3"
    cmd_ffmpeg = [
        ffmpeg,
        "-y",
        "-i", str(wav_path),
        "-b:a", "192k",
        str(mp3_path),
    ]

    logger.info("🎧 [Synth] 转码 WAV -> MP3: %s", mp3_path.name)
    logger.info("▶  %s", " ".join(cmd_ffmpeg))
    t_ff0 = perf_counter()
    _run_cmd(cmd_ffmpeg, err_prefix="ffmpeg 转码失败")
    ffmpeg_ms = (perf_counter() - t_ff0) * 1000.0

    if not mp3_path.exists() or mp3_path.stat().st_size == 0:
        raise RuntimeError("ffmpeg 执行完成，但未生成有效 MP3 文件。")

    # 4) 清理中间 wav（可配置）
    if not keep_wav:
        try:
            wav_path.unlink()
        except OSError:
            pass

    logger.info(
        "[H2S timing] midi_to_audio fluidsynth_ms=%.1f ffmpeg_ms=%.1f output_format=mp3",
        fluidsynth_ms,
        ffmpeg_ms,
    )
    logger.info("✅ [Synth] 输出完成: %s", mp3_path.name)
    return mp3_path