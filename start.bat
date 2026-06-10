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

echo Revisando servidor anterior en puerto 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$app=(Resolve-Path -LiteralPath '%APP_DIR%').Path; Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $proc=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $_.OwningProcess); if ($proc.CommandLine -like ('*' + $app + '*')) { Stop-Process -Id $_.OwningProcess -Force; Write-Host ('Servidor anterior detenido (PID ' + $_.OwningProcess + ').') } else { Write-Host ('El puerto 3000 esta ocupado por otro proceso (PID ' + $_.OwningProcess + ').'); exit 2 } }"
if errorlevel 2 (
  echo.
  echo El puerto 3000 esta ocupado por otro programa. Cierra ese programa o libera el puerto antes de iniciar.
  pause
  exit /b 1
)

echo.
echo Iniciando la version actual desde:
echo %CD%
echo.
echo Modo local/demo activado. No se conectara a Supabase.
echo Sitio: http://localhost:3000
echo Presiona Ctrl+C para detenerlo.
echo.

call npm run dev -- --port 3000

pause
