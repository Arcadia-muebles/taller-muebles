@echo off
setlocal

set "APP_DIR=%~dp0taller-muebles"
set "LOCAL_DEMO_MODE=1"

cd /d "%APP_DIR%"
if errorlevel 1 (
  echo No se pudo entrar a la carpeta taller-muebles.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando la version actual desde:
echo %CD%
echo.
echo Modo local/demo activado. No se conectara a Supabase.
echo Sitio: http://localhost:3000
echo Presiona Ctrl+C para detenerlo.
echo.

call npm run dev

pause
