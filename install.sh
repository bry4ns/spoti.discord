#!/bin/bash

echo "🤖 Instalando Bot de Discord con Reconocimiento Local"
echo "=================================================="

# Instalar dependencias de Node.js
echo "📦 Instalando dependencias de Node.js..."
npm install

# Crear directorio para modelos
echo "📁 Creando directorio para modelos de voz..."
mkdir -p models

# Verificar si wget está disponible
if command -v wget &> /dev/null; then
    echo "📥 Descargando modelo de voz en español..."
    echo "⚠️  Esto puede tomar varios minutos (1.4GB)..."
    
    cd models
    wget https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip
    
    if [ -f "vosk-model-es-0.42.zip" ]; then
        echo "📂 Extrayendo modelo..."
        unzip vosk-model-es-0.42.zip
        rm vosk-model-es-0.42.zip
        echo "✅ Modelo instalado correctamente"
    else
        echo "❌ Error descargando el modelo"
    fi
    
    cd ..
else
    echo "⚠️  wget no encontrado. Descarga manual requerida:"
    echo "1. Ve a: https://alphacephei.com/vosk/models"
    echo "2. Descarga: vosk-model-es-0.42.zip"
    echo "3. Extrae en: ./models/"
fi

# Crear archivo .env si no existe
if [ ! -f ".env" ]; then
    echo "📝 Creando archivo .env..."
    cp .env.example .env
    echo "⚠️  Edita el archivo .env con tus credenciales"
fi

echo ""
echo "🎉 Instalación completada!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Edita .env con tus tokens de Discord y Spotify"
echo "2. Ejecuta: npm start"
echo ""
echo "🔒 Tu voz se procesa 100% localmente - Sin envío a servidores externos"