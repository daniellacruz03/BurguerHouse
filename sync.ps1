# ============================================================
#  Burger House - Script de sincronizacion web a APK
#  Ejecuta este script cada vez que hagas cambios en el codigo
#  para actualizar tanto la carpeta www/ como el proyecto Android
# ============================================================

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "BURGER HOUSE SYNC" -ForegroundColor Red
Write-Host "=====================================" -ForegroundColor DarkGray
Write-Host ""

# -- 1. Copiar archivos web principales ----------------------
Write-Host "Copiando archivos web..." -ForegroundColor Yellow

$archivos = @(
    "index.html",
    "app.js",
    "stories.js",
    "style.css",
    "style-tailwind.css",
    "admin.html",
    "404.html",
    "mantenimiento.html",
    "privacidad.html"
)

foreach ($archivo in $archivos) {
    $origen  = Join-Path $root $archivo
    $destino = Join-Path $root "www\$archivo"
    if (Test-Path $origen) {
        Copy-Item -Path $origen -Destination $destino -Force
        Write-Host "   OK $archivo" -ForegroundColor Green
    }
}

# -- 2. Sincronizar carpeta images/ --------------------------
Write-Host ""
Write-Host "Sincronizando imagenes..." -ForegroundColor Yellow

$srcImages  = Join-Path $root "images"
$destImages = Join-Path $root "www\images"

if (Test-Path $srcImages) {
    $nuevas = 0
    Get-ChildItem -Path $srcImages -File | ForEach-Object {
        $destFile = Join-Path $destImages $_.Name
        if (-not (Test-Path $destFile) -or ($_.LastWriteTime -gt (Get-Item $destFile).LastWriteTime)) {
            Copy-Item -Path $_.FullName -Destination $destFile -Force
            $nuevas++
        }
    }
    if ($nuevas -gt 0) {
        Write-Host "   OK $nuevas imagen(es) actualizada(s)" -ForegroundColor Green
    } else {
        Write-Host "   Sin cambios en imagenes" -ForegroundColor DarkGray
    }
} else {
    Write-Host "   AVISO: Carpeta images/ no encontrada" -ForegroundColor DarkYellow
}

# -- 3. Ejecutar npx cap sync --------------------------------
Write-Host ""
Write-Host "Ejecutando cap sync..." -ForegroundColor Yellow
Write-Host ""

Set-Location $root
npx cap sync

# -- 4. Resumen final ----------------------------------------
Write-Host ""
Write-Host "=====================================" -ForegroundColor DarkGray
Write-Host "LISTO! Dale Play en Android Studio" -ForegroundColor Green
Write-Host ""
Write-Host "Para desplegar la web: firebase deploy" -ForegroundColor DarkGray
Write-Host ""

Write-Host "Presiona cualquier tecla para cerrar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
