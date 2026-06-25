#!/bin/bash

# Obtener la carpeta donde se encuentra este script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$DIR/taller-muebles"

cd "$APP_DIR" || {
  echo "No se pudo entrar a la carpeta taller-muebles."
  echo "Presiona cualquier tecla para salir..."
  read -n 1 -s
  exit 1
}

# Instalar dependencias si no existe node_modules
if [ ! -d "node_modules" ]; then
  echo "Instalando dependencias..."
  npm install
  if [ $? -ne 0 ]; then
    echo "Fallo la instalacion de dependencias."
    echo "Presiona cualquier tecla para salir..."
    read -n 1 -s
    exit 1
  fi
fi

# Revisar si el puerto 3000 está ocupado
PID=$(lsof -t -i :3000)
if [ ! -z "$PID" ]; then
  echo "El puerto 3000 esta siendo usado (PID: $PID)."
  CMD=$(ps -p $PID -o command= 2>/dev/null)
  
  # Si parece ser un proceso de node/next, lo detenemos automáticamente
  if [[ "$CMD" == *"node"* || "$CMD" == *"next"* ]]; then
    echo "Deteniendo servidor anterior de Node/Next (PID $PID)..."
    kill -9 $PID 2>/dev/null
    sleep 1
  else
    echo "El puerto 3000 esta ocupado por otro proceso:"
    echo "  $CMD"
    echo "Cierra ese programa o libera el puerto antes de iniciar."
    echo "Presiona cualquier tecla para salir..."
    read -n 1 -s
    exit 1
  fi
fi

echo ""
echo "Iniciando la version actual desde:"
echo "$(pwd)"
echo ""
echo "Sitio: http://localhost:3000"
echo "Presiona Ctrl+C para detenerlo."
echo ""

npm run dev -- --port 3000

echo "Presiona cualquier tecla para salir..."
read -n 1 -s
