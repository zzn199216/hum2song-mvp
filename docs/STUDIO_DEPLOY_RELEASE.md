# Studio production release checklist

Host: SSH alias `aliyun-music-core`.

Current production uses `/opt/hum2song/studio/current` and immutable releases
under `/opt/hum2song/studio/releases`. Package static changes only through:

```bash
bash scripts/deploy/package-studio-delta-artifact.sh \
  --base <active-production-commit> \
  --version <new-cache-version>
```

The packager runs the complete frontend suite and refuses stale bases, dirty
tracked files, deletes/renames, or mixed asset cache versions. Deploy the
result with the Cloud ops repository's
`scripts/deploy/deploy-studio-delta-artifact.sh`; it verifies `baseCommit`
against the active release and automatically rolls back on failed health.

## Package requirements

Each release under `/root/hum2song-studio-releases/<commit-short>` must include:

- A working `venv` (reuse previous release venv when `requirements.txt` unchanged). On disk-constrained hosts, symlink instead of copying: `ln -sfn ../<previous>/venv "${NEW_RELEASE}/venv"`.
- `assets/piano.sf2` — either a real file or a symlink to a system SoundFont (e.g. `/usr/share/sounds/sf2/FluidR3_GM.sf2`). Do **not** rely on a deleted older release path.

## Pre-cutover validation

```bash
NEW_RELEASE=/root/hum2song-studio-releases/<commit-short>
bash scripts/validate_studio_release.sh "${NEW_RELEASE}"
```

## Cloud Web origins

Production Studio CORS and iframe parent trust must use exact origins. Do not use `*` or wildcard subdomains.

For China + global Cloud Web, set:

```bash
CORS_ALLOW_ORIGINS=https://hum2song.cn,https://www.hum2song.cn,https://hum2song.com,https://www.hum2song.com,https://studio.hum2song.com
H2S_CLOUD_PARENT_ORIGINS=https://hum2song.cn,https://www.hum2song.cn,https://hum2song.com,https://www.hum2song.com
```

`CORS_ALLOW_ORIGINS` may include Studio's own origin for browser/static requests. `H2S_CLOUD_PARENT_ORIGINS` should list the Cloud Web parent page origins that embed the Studio iframe, for example `https://hum2song.com`; it should not list only the iframe URL itself.

If `assets/piano.sf2` is missing but the system SoundFont exists:

```bash
ln -sfn /usr/share/sounds/sf2/FluidR3_GM.sf2 "${NEW_RELEASE}/assets/piano.sf2"
bash scripts/validate_studio_release.sh "${NEW_RELEASE}"
```

## Cutover

```bash
PREVIOUS=$(readlink -f /root/hum2song-studio)
ln -sfn "${NEW_RELEASE}" /root/hum2song-studio
systemctl restart hum2song-studio.service
systemctl is-active hum2song-studio.service
curl -fsS https://studio.hum2song.cn/api/v1/health | grep soundfont_exists
```

## Cleanup rule

Never delete the active release, the previous rollback target, or any release still referenced by `readlink -f /root/hum2song-studio`. Old releases that only held `assets/piano.sf2` symlinks must not be the sole SoundFont source for the live release.
