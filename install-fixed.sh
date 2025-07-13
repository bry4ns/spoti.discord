#!/bin/bash

echo "🤖 Bot de Discord - Instalación Mejorada"
echo "========================================"

# Función para verificar comandos
check_command() {
    if command -v $1 &> /dev/null; then
        echo "✅ $1 encontrado"
        return 0
    else
        echo "❌ $1 no encontrado"
        return 1
    fi
}

# Verificar Node.js
echo "🔍 Verificando requisitos del sistema..."
if ! check_command node; then
    echo "❌ Node.js no está instalado"
    echo "📥 Instala Node.js desde: https://nodejs.org/"
    exit 1
fi

if ! check_command npm; then
    echo "❌ npm no está instalado"
    exit 1
fi

# Verificar versión de Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js versión 16+ requerida. Versión actual: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) - OK"

# Instalar dependencias principales
echo ""
echo "📦 Instalando dependencias principales..."
npm install --save discord.js@^14.14.1 @discordjs/voice@^0.16.1 spotify-web-api-node@^5.0.2 ytdl-core@^4.11.5 prism-media@^1.3.5 ffmpeg-static@^5.2.0

if [ $? -ne 0 ]; then
    echo "❌ Error instalando dependencias principales"
    exit 1
fi

echo "✅ Dependencias principales instaladas"

# Instalar dependencias opcionales
echo ""
echo "📦 Instalando dependencias opcionales..."

# Intentar instalar node-opus
echo "🔄 Instalando node-opus..."
npm install --save node-opus@^0.3.3 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ node-opus instalado"
else
    echo "⚠️ node-opus falló (opcional)"
fi

# Intentar instalar Vosk
echo "🔄 Instalando Vosk..."
VOSK_VERSIONS=("0.3.32" "0.3.31" "0.3.30" "0.3.28")

for version in "${VOSK_VERSIONS[@]}"; do
    echo "Probando Vosk v$version..."
    npm install --save vosk@$version 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Vosk v$version instalado correctamente"
        VOSK_INSTALLED=true
        break
    else
        echo "⚠️ Vosk v$version falló, probando siguiente..."
    fi
done

if [ -z "$VOSK_INSTALLED" ]; then
    echo "⚠️ Vosk no se pudo instalar (el bot funcionará con reconocimiento básico)"
fi

# Crear directorios
echo ""
echo "📁 Creando directorios..."
mkdir -p models scripts logs

# Crear archivo .env si no existe
if [ ! -f ".env" ]; then
    echo "📝 Creando archivo .env..."
    cat > .env << 'EOF'
# Discord Bot Token
DISCORD_TOKEN=tu_token_de_discord_aqui

# Spotify API Credentials
SPOTIFY_CLIENT_ID=tu_client_id_de_spotify
SPOTIFY_CLIENT_SECRET=tu_client_secret_de_spotify

# Bot Configuration (Opcional)
BOT_PREFIX=!
DEFAULT_VOLUME=50
MAX_QUEUE_SIZE=50
EOF
    echo "✅ Archivo .env creado"
else
    echo "✅ Archivo .env ya existe"
fi

# Configurar modelos de Vosk si está instalado
if [ ! -z "$VOSK_INSTALLED" ]; then
    echo ""
    echo "🤖 Configurando modelos de reconocimiento de voz..."
    
    # Verificar si ya existe algún modelo
    if ls models/vosk-model-*-es-* 1> /dev/null 2>&1; then
        echo "✅ Modelo de voz ya existe"
    else
        echo "📥 Descargando modelo de voz (esto puede tomar varios minutos)..."
        
        cd models
        
        # Intentar descargar modelo pequeño primero
        if check_command wget; then
            echo "📥 Descargando modelo pequeño (40MB)..."
            wget -q --show-progress https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
            
            if [ -f "vosk-model-small-es-0.42.zip" ]; then
                echo "📂 Extrayendo modelo..."
                unzip -q vosk-model-small-es-0.42.zip
                rm vosk-model-small-es-0.42.zip
                echo "✅ Modelo de voz instalado correctamente"
            else
                echo "❌ Error descargando modelo"
            fi
        elif check_command curl; then
            echo "📥 Descargando modelo pequeño con curl..."
            curl -L -o vosk-model-small-es-0.42.zip https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
            
            if [ -f "vosk-model-small-es-0.42.zip" ]; then
                echo "📂 Extrayendo modelo..."
                unzip -q vosk-model-small-es-0.42.zip
                rm vosk-model-small-es-0.42.zip
                echo "✅ Modelo de voz instalado correctamente"
            fi
        else
            echo "⚠️ wget/curl no encontrado. Descarga manual requerida:"
            echo "1. Ve a: https://alphacephei.com/vosk/models"
            echo "2. Descarga: vosk-model-small-es-0.42.zip"
            echo "3. Extrae en: ./models/"
        fi
        
        cd ..
    fi
fi

# Crear script de inicio
echo ""
echo "📝 Creando scripts de utilidad..."

cat > start.sh << 'EOF'
#!/bin/bash
echo "🚀 Iniciando Bot de Discord..."
echo "Presiona Ctrl+C para detener"
echo ""
node index.js
EOF

chmod +x start.sh

# Resumen final
echo ""
echo "🎉 ¡Instalación completada!"
echo "=========================="
echo ""
echo "📋 Próximos pasos:"
echo "1. Edita .env con tus tokens:"
echo "   - Token de Discord Bot"
echo "   - Client ID y Secret de Spotify"
echo ""
echo "2. Inicia el bot:"
echo "   npm start"
echo "   # o"
echo "   ./start.sh"
echo ""
echo "3. Comandos en Discord:"
echo "   !join    - Conectar bot al canal de voz"
echo "   !listen  - Activar reconocimiento de voz"
echo "   !play    - Reproducir música"
echo ""

if [ -z "$VOSK_INSTALLED" ]; then
    echo "⚠️ NOTA: Vosk no está instalado"
    echo "   El bot funcionará con reconocimiento básico"
    echo "   Para instalar Vosk: npm run install-vosk"
    echo ""
fi

echo "🔒 Tu voz se procesa 100% localmente"
echo "📖 Lee README.md para más información"