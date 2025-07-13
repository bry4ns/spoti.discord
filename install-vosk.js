const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

class VoskInstaller {
    constructor() {
        this.modelsDir = './models';
        this.voskVersion = '0.3.32';
    }

    async install() {
        console.log('🤖 Instalador Automático de Vosk');
        console.log('=' .repeat(40));

        try {
            await this.installVoskPackage();
            await this.createModelsDirectory();
            await this.downloadModel();
            
            console.log('\n🎉 ¡Vosk instalado correctamente!');
            console.log('✅ Ya puedes usar reconocimiento de voz avanzado');
            
        } catch (error) {
            console.error('❌ Error en instalación:', error.message);
            console.log('\n🔧 Instalación manual requerida:');
            this.showManualSteps();
        }
    }

    async installVoskPackage() {
        console.log('📦 Instalando paquete Vosk...');
        
        try {
            // Intentar diferentes versiones de Vosk
            const versions = ['0.3.32', '0.3.31', '0.3.30'];
            
            for (const version of versions) {
                try {
                    console.log(`Probando Vosk v${version}...`);
                    execSync(`npm install vosk@${version}`, { stdio: 'pipe' });
                    console.log(`✅ Vosk v${version} instalado correctamente`);
                    this.voskVersion = version;
                    return;
                } catch (error) {
                    console.log(`⚠️ Vosk v${version} falló, probando siguiente...`);
                }
            }
            
            throw new Error('No se pudo instalar ninguna versión de Vosk');
            
        } catch (error) {
            throw new Error(`Error instalando Vosk: ${error.message}`);
        }
    }

    async createModelsDirectory() {
        console.log('📁 Creando directorio de modelos...');
        
        if (!fs.existsSync(this.modelsDir)) {
            fs.mkdirSync(this.modelsDir, { recursive: true });
        }
        
        console.log('✅ Directorio models/ listo');
    }

    async downloadModel() {
        console.log('📥 Descargando modelo de voz...');
        console.log('ℹ️ Esto puede tomar varios minutos...');
        
        // Intentar descargar modelo pequeño primero
        const models = [
            {
                name: 'vosk-model-small-es-0.42',
                url: 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip',
                size: '40MB'
            },
            {
                name: 'vosk-model-es-0.42',
                url: 'https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip',
                size: '1.4GB'
            }
        ];

        for (const model of models) {
            try {
                console.log(`📥 Descargando ${model.name} (${model.size})...`);
                await this.downloadAndExtract(model.url, model.name);
                console.log(`✅ ${model.name} instalado correctamente`);
                return;
            } catch (error) {
                console.log(`⚠️ Error con ${model.name}: ${error.message}`);
            }
        }

        throw new Error('No se pudo descargar ningún modelo');
    }

    async downloadAndExtract(url, modelName) {
        const zipPath = path.join(this.modelsDir, `${modelName}.zip`);
        const extractPath = path.join(this.modelsDir, modelName);

        // Verificar si ya existe
        if (fs.existsSync(extractPath)) {
            console.log(`✅ ${modelName} ya existe`);
            return;
        }

        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(zipPath);
            
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
                    process.stdout.write(`\r📥 Descargando: ${progress}%`);
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    console.log('\n📂 Extrayendo archivo...');
                    
                    try {
                        // Intentar extraer con diferentes métodos
                        this.extractZip(zipPath, this.modelsDir);
                        
                        // Limpiar archivo zip
                        fs.unlinkSync(zipPath);
                        
                        resolve();
                    } catch (error) {
                        reject(new Error(`Error extrayendo: ${error.message}`));
                    }
                });

                file.on('error', (error) => {
                    fs.unlink(zipPath, () => {}); // Limpiar archivo parcial
                    reject(error);
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    extractZip(zipPath, extractDir) {
        try {
            // Intentar con unzip (Linux/Mac)
            execSync(`unzip -q "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
        } catch (error) {
            try {
                // Intentar con PowerShell (Windows)
                execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}'"`, { stdio: 'pipe' });
            } catch (error2) {
                throw new Error('No se pudo extraer el archivo. Instala unzip o usa Windows con PowerShell');
            }
        }
    }

    showManualSteps() {
        console.log(`
🔧 PASOS MANUALES:

1. Instalar Vosk:
   npm install vosk@${this.voskVersion}

2. Crear directorio:
   mkdir -p models

3. Descargar modelo (elige uno):
   
   OPCIÓN A - Modelo pequeño (40MB):
   wget https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
   unzip vosk-model-small-es-0.42.zip -d models/
   
   OPCIÓN B - Modelo completo (1.4GB):
   wget https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip
   unzip vosk-model-es-0.42.zip -d models/

4. Verificar estructura:
   ls models/vosk-model-*-es-*/

5. Reiniciar bot:
   npm start
        `);
    }
}

// Ejecutar instalador si se llama directamente
if (require.main === module) {
    const installer = new VoskInstaller();
    installer.install();
}

module.exports = VoskInstaller;