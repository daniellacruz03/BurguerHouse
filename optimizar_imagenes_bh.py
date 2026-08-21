# Script para re-optimizar imagenes WebP existentes y convertir JPG/PNG
# Objetivo: dejar todas las imagenes debajo de 90 KB

import os
from PIL import Image

def optimizar_todo(directorio_proyecto):
    print(f"Iniciando re-optimizacion en: {directorio_proyecto}\n")

    MAX_WIDTH = 800       # Max ancho en px para imagenes del menu
    QUALITY_TARGET = 72   # Calidad WebP base
    MAX_SIZE_KB = 90      # Si supera esto, baja la calidad mas agresivamente

    extensiones_imagen = ('.jpg', '.jpeg', '.png', '.webp')
    extensiones_codigo = ('.html', '.js', '.css')

    imagenes_convertidas = {}
    optimizadas = 0
    ahorradas_kb = 0

    EXCLUDED = ('node_modules', '.git', '.firebase', 'assets', 'videos_crudos', 'android', 'www', '.gradle', '.idea', '.kotlin', 'build')
    for raiz, dirs, archivos in os.walk(directorio_proyecto):
        dirs[:] = [d for d in dirs if d not in EXCLUDED]

        for archivo in archivos:
            extension_actual = os.path.splitext(archivo)[1].lower()
            if extension_actual not in extensiones_imagen:
                continue

            ruta_original = os.path.join(raiz, archivo)
            nombre_base = os.path.splitext(archivo)[0]
            ruta_webp = os.path.join(raiz, nombre_base + '.webp')

            tamano_antes_kb = os.path.getsize(ruta_original) / 1024

            try:
                with Image.open(ruta_original) as img_orig:
                    img_orig.load() # Load image data into memory before closing the file
                    if img_orig.mode in ('RGBA', 'P', 'LA'):
                        img = img_orig.convert('RGBA')
                    else:
                        img = img_orig.convert('RGB')

                    width, height = img.size
                    if width > MAX_WIDTH:
                        ratio = MAX_WIDTH / float(width)
                        new_height = int(float(height) * ratio)
                        try:
                            resample_filter = Image.Resampling.LANCZOS
                        except AttributeError:
                            resample_filter = Image.LANCZOS
                        img = img.resize((MAX_WIDTH, new_height), resample_filter)
                        print(f"  Redimensionada: {archivo} ({width}px -> {MAX_WIDTH}px)")

                # Ajustar calidad segun tamano
                calidad = QUALITY_TARGET
                if tamano_antes_kb > MAX_SIZE_KB * 2:
                    calidad = 60
                elif tamano_antes_kb > MAX_SIZE_KB:
                    calidad = 68

                img.save(ruta_webp, 'WEBP', quality=calidad, method=6)

                tamano_despues_kb = os.path.getsize(ruta_webp) / 1024
                ahorro = tamano_antes_kb - tamano_despues_kb
                ahorradas_kb += ahorro
                optimizadas += 1

                estado = "OK" if tamano_despues_kb < MAX_SIZE_KB else "GRANDE"
                print(f"  [{estado}] {archivo}: {tamano_antes_kb:.0f}KB -> {tamano_despues_kb:.0f}KB  (calidad: {calidad})")

                if extension_actual != '.webp':
                    imagenes_convertidas[archivo] = nombre_base + '.webp'

            except Exception as e:
                print(f"  ERROR con {archivo}: {e}")

    print(f"\nTotal: {optimizadas} imagenes | Ahorro: {ahorradas_kb:.0f} KB ({ahorradas_kb/1024:.1f} MB)\n")

    if imagenes_convertidas:
        print("Actualizando referencias en codigo...")
        for raiz, dirs, archivos in os.walk(directorio_proyecto):
            dirs[:] = [d for d in dirs if d not in EXCLUDED]
            for archivo in archivos:
                if not archivo.lower().endswith(tuple(extensiones_codigo)):
                    continue
                ruta_codigo = os.path.join(raiz, archivo)
                try:
                    with open(ruta_codigo, 'r', encoding='utf-8') as f:
                        contenido = f.read()
                    contenido_nuevo = contenido
                    for viejo, nuevo in imagenes_convertidas.items():
                        contenido_nuevo = contenido_nuevo.replace(viejo, nuevo)
                    if contenido_nuevo != contenido:
                        with open(ruta_codigo, 'w', encoding='utf-8') as f:
                            f.write(contenido_nuevo)
                        print(f"  Actualizado: {archivo}")
                except Exception as e:
                    print(f"  Error en {archivo}: {e}")

    print("\nOptimizacion completa!")

if __name__ == "__main__":
    optimizar_todo(".")

