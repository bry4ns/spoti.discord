const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

class BotSetup {
    constructor() {
        this.modelsDir = './models';
        this.envFile = '.env';
    }

    async run() {
        console.log('🚀 Configurando Bot de Discord con Reconocimiento Local');
        console.log('=' .repeat(60));

        try {
            await this.createDirectories();
            await this.checkDependencies();
            await this.setupEnvironment();
            await this.offerModelDownload();
            
            console.log('\n🎉 ¡Configuración completada!');
            console.log('\n📋 Próximos pasos:');
            console.log('1. Edita .env con tus tokens de Discord y Spotify');
            console.log('2. Ejecuta: npm start');
            console.log('3. Usa !join en Discord para conectar el bot');
            console.log('4. Usa !listen para activar reconocimiento de voz');
            
        } catch (error) {
            console.error('❌ Error en configuración:', error.message);
            process.exit(1);
        }
    }

    async createDirectories() {
        console.log('📁 Creando directorios necesarios...');
        
        if (!fs.existsSync(this.modelsDir)) {
            fs.mkdirSync(this.modelsDir, { recursive: true });
            console.log('✅ Directorio models/ creado');
        }

        if (!fs.existsSync('./scripts')) {
            fs.mkdirSync('./scripts', { recursive: true });
            console.log('✅ Directorio scripts/ creado');
        }
    }

    async checkDependencies() {
        console.log('🔍 Verificando dependencias...');
        
        const requiredDeps = [
            'discord.js',
            '@discordjs/voice',
            'spotify-web-api-node',
            'ytdl-core'
        ];

        for (const dep of requiredDeps) {
            try {
                require.resolve(dep);
                console.log(`✅ ${dep} - OK`);
            } catch (error) {
                console.log(`❌ ${dep} - FALTA`);
                throw new Error(`Dependencia faltante: ${dep}. Ejecuta: npm install`);
            }
        }

        // Verificar dependencias opcionales
        this.checkOptionalDependency('vosk', 'Reconocimiento de voz avanzado');
        this.checkOptionalDependency('node-opus', 'Codificación de audio');
        this.checkOptionalDependency('ffmpeg-static', 'Procesamiento de audio');
    }

    checkOptionalDependency(dep, description) {
        try {
            require.resolve(dep);
            console.log(`✅ ${dep} - OK (${description})`);
        } catch (error) {
            console.log(`⚠️ ${dep} - OPCIONAL (${description})`);
        }
    }

    async setupEnvironment() {
        console.log('⚙️ Configurando variables de entorno...');
        
        if (!fs.existsSync(this.envFile)) {
            const envTemplate = `# Discord Bot Configuration
DISCORD_TOKEN=tu_token_de_discord_aqui

# Spotify API Configuration  
SPOTIFY_CLIENT_ID=tu_client_id_de_spotify
SPOTIFY_CLIENT_SECRET=tu_client_secret_de_spotify

# Optional: Bot Configuration
BOT_PREFIX=!
DEFAULT_VOLUME=50
MAX_QUEUE_SIZE=50
`;
            
            fs.writeFileSync(this.envFile, envTemplate);
            console.log('✅ Archivo .env creado');
        } else {
            console.log('✅ Archivo .env ya existe');
        }
    }

    async offerModelDownload() {
        console.log('\n🤖 Configuración de Reconocimiento de Voz');
        console.log('-'.repeat(40));
        
        const hasVosk = this.checkVoskInstallation();
        
        if (!hasVosk) {
            console.log('📥 Vosk no está instalado. Opciones disponibles:');
            console.log('\n1. INSTALACIÓN AUTOMÁTICA (Recomendado):');
            console.log('   npm run install-vosk');
            console.log('\n2. INSTALACIÓN MANUAL:');
            this.showManualInstructions();
            console.log('\n3. USAR SIN VOSK:');
            console.log('   El bot funcionará con reconocimiento básico por patrones');
        } else {
            console.log('✅ Vosk ya está instalado');
            this.checkModels();
        }
    }

    checkVoskInstallation() {
        try {
            require.resolve('vosk');
            return true;
        } catch (error) {
            return false;
        }
    }

    checkModels() {
        const models = [
            'vosk-model-small-es-0.42',
            'vosk-model-es-0.42'
        ];

        let foundModels = 0;
        
        for (const model of models) {
            const modelPath = path.join(this.modelsDir, model);
            if (fs.existsSync(modelPath)) {
                console.log(`✅ Modelo encontrado: ${model}`);
                foundModels++;
            }
        }

        if (foundModels === 0) {
            console.log('⚠️ No se encontraron modelos de voz');
            console.log('Ejecuta: npm run install-vosk');
        }
    }

    showManualInstructions() {
        console.log(`
   Pasos manuales:
   a) Instalar Vosk: npm install vosk@0.3.32
   b) Crear directorio: mkdir -p models
   c) Descargar modelo:
      - Pequeño (40MB): https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
      - Completo (1.4GB): https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip
   d) Extraer en: ./models/
        `);
    }
}

// Ejecutar setup si se llama directamente
if (require.main === module) {
    const setup = new BotSetup();
    setup.run();
}

module.exports = BotSetup;