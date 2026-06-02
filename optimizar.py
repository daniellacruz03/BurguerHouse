#!/usr/bin/env python3
"""
Optimiza videos MP4 para historias web burger House.

- Entrada:  videos_crudos/*.mp4 (raíz del proyecto)
- Salida:   assets/videos/*.mp4 (H.264, 480×854, CRF 28)
- Extra:    assets/videos/*.jpg (miniatura para círculos de historias)

Requisitos:
    pip install ffmpeg-python
    FFmpeg instalado en el PATH (https://ffmpeg.org/download.html)
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import ffmpeg
except ImportError:
    print("❌ Falta ffmpeg-python. Instala con: pip install ffmpeg-python")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent
INPUT_DIR = ROOT / "videos_crudos"
OUTPUT_DIR = ROOT / "assets" / "videos"

WIDTH = 480
HEIGHT = 854
CRF = 28

# Filtro: escala proporcional + bandas negras para formato vertical 9:16
SCALE_PAD = (
    f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
    f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:black"
)


def optimizar_video(ruta_entrada: Path, ruta_salida: Path) -> None:
    """Transcodifica a H.264 vertical ligero con audio AAC."""
    stream = ffmpeg.input(str(ruta_entrada))
    stream = ffmpeg.output(
        stream,
        str(ruta_salida),
        vcodec="libx264",
        crf=CRF,
        preset="medium",
        vf=SCALE_PAD,
        pix_fmt="yuv420p",
        movflags="+faststart",
        acodec="aac",
        audio_bitrate="96k",
    )
    ffmpeg.run(stream, overwrite_output=True, quiet=False)


def generar_poster(ruta_entrada: Path, ruta_poster: Path, segundo: float = 1.0) -> None:
    """Extrae un frame JPEG para la miniatura del círculo."""
    stream = ffmpeg.input(str(ruta_entrada), ss=segundo)
    stream = ffmpeg.output(stream, str(ruta_poster), vframes=1, **{"q:v": 3})
    ffmpeg.run(stream, overwrite_output=True, quiet=True)


def tamano_mb(ruta: Path) -> float:
    return ruta.stat().st_size / (1024 * 1024)


def main() -> None:
    if not INPUT_DIR.is_dir():
        print(f"❌ No existe la carpeta de entrada: {INPUT_DIR}")
        print("   Crea 'videos_crudos' y coloca ahí tus .mp4")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    videos = sorted(INPUT_DIR.glob("*.mp4")) + sorted(INPUT_DIR.glob("*.MP4"))
    if not videos:
        print(f"⚠ No hay archivos .mp4 en {INPUT_DIR}")
        return

    print(f"🎬 burger House — optimización de {len(videos)} video(s)\n")
    print(f"   Entrada:  {INPUT_DIR}")
    print(f"   Salida:   {OUTPUT_DIR}")
    print(f"   Perfil:   {WIDTH}×{HEIGHT}, H.264, CRF {CRF}\n")

    ok = 0
    errores = 0

    for entrada in videos:
        nombre = entrada.name
        salida = OUTPUT_DIR / nombre
        poster = OUTPUT_DIR / f"{entrada.stem}.jpg"

        print(f"▶ {nombre} …")
        try:
            optimizar_video(entrada, salida)
            generar_poster(salida, poster)
            mb = tamano_mb(salida)
            estado = "✅" if mb <= 2.5 else "⚠"
            print(f"  {estado} Video: {salida.name} ({mb:.2f} MB)")
            print(f"  ✅ Poster: {poster.name}\n")
            ok += 1
        except ffmpeg.Error as e:
            errores += 1
            stderr = e.stderr.decode("utf-8", errors="replace") if e.stderr else str(e)
            print(f"  ❌ Error FFmpeg:\n{stderr}\n")
        except Exception as e:
            errores += 1
            print(f"  ❌ Error: {e}\n")

    print("—" * 40)
    print(f"Listo: {ok} optimizado(s), {errores} error(es).")
    if ok:
        print("\n✨ COPIA ESTE CÓDIGO PARA TU stories.js:")
        print("-" * 40)
        js_array = ",\n        ".join([f"'./assets/videos/{v.name}'" for v in sorted(OUTPUT_DIR.glob("*.mp4"))])
        print(f"    const videoSources = [\n        {js_array}\n    ];")
        print("-" * 40)
        print("\nRecarga la web; las historias ahora están sincronizadas.")


if __name__ == "__main__":
    main()
