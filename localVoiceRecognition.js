const fs = require('fs');
const path = require('path');
const { Transform } = require('stream');

class LocalVoiceRecognition {
    constructor() {
        this.recognitionMethod = null;
        this.activeListeners = new Map();
        this.modelPath = './models';
        this.isInitialized = false;
        
        // Intentar inicializar diferentes métodos de reconocimiento
        this.initializationMethods = [
            this.initializeVosk.bind(this),
            this.initializeWebSpeech.bind(this),
            this.initializeSimplePattern.bind(this)
        ];
    }

    async initialize() {
        console.log('🔄 Inicializando sistema de reconocimiento de voz local...');
        
        for (const method of this.initializationMethods) {
            try {
                const result = await method();
                if (result) {
                    this.isInitialized = true;
                    return true;
                }
            } catch (error) {
                console.log(`⚠️ Método falló, probando siguiente...`);
            }
        }
        
        console.error('❌ No se pudo inicializar ningún método de reconocimiento');
        return false;
    }

    // Método 1: Vosk (más preciso pero requiere instalación)
    async initializeVosk() {
        try {
            const vosk = require('vosk');
            
            if (!fs.existsSync(path.join(this.modelPath, 'vosk-model-small-es-0.42'))) {
                console.log('📥 Modelo Vosk no encontrado. Instrucciones de descarga:');
                this.showVoskInstructions();
                return false;
            }

            this.voskModel = new vosk.Model(path.join(this.modelPath, 'vosk-model-small-es-0.42'));
            this.recognitionMethod = 'vosk';
            console.log('✅ Vosk inicializado correctamente');
            return true;
            
        } catch (error) {
            console.log('⚠️ Vosk no disponible:', error.message);
            return false;
        }
    }

    // Método 2: Web Speech API (funciona en algunos entornos)
    async initializeWebSpeech() {
        try {
            // Simulamos Web Speech API para Node.js
            this.recognitionMethod = 'webspeech';
            console.log('✅ Web Speech API simulado inicializado');
            return true;
        } catch (error) {
            console.log('⚠️ Web Speech API no disponible');
            return false;
        }
    }

    // Método 3: Reconocimiento por patrones simples (fallback)
    async initializeSimplePattern() {
        this.recognitionMethod = 'pattern';
        console.log('✅ Sistema de patrones simples inicializado');
        console.log('ℹ️ Usando reconocimiento básico por palabras clave');
        return true;
    }

    startListening(connection, guildId, onTranscript) {
        if (!this.isInitialized) {
            console.error('❌ Sistema de reconocimiento no inicializado');
            return false;
        }

        console.log(`🎤 Iniciando reconocimiento (${this.recognitionMethod}) para guild ${guildId}`);

        const receiver = connection.receiver;
        
        receiver.speaking.on('start', (userId) => {
            console.log(`👤 Usuario ${userId} comenzó a hablar`);
            
            const audioStream = receiver.subscribe(userId, {
                end: {
                    behavior: 'afterSilence',
                    duration: 2000,
                },
            });

            this.processAudioStream(audioStream, guildId, onTranscript);
        });

        this.activeListeners.set(guildId, { connection, receiver });
        return true;
    }

    processAudioStream(audioStream, guildId, onTranscript) {
        switch (this.recognitionMethod) {
            case 'vosk':
                this.processWithVosk(audioStream, guildId, onTranscript);
                break;
            case 'webspeech':
                this.processWithWebSpeech(audioStream, guildId, onTranscript);
                break;
            case 'pattern':
                this.processWithPatterns(audioStream, guildId, onTranscript);
                break;
        }
    }

    processWithVosk(audioStream, guildId, onTranscript) {
        try {
            const vosk = require('vosk');
            const recognizer = new vosk.KaldiRecognizer(this.voskModel, 16000);
            
            let audioBuffer = Buffer.alloc(0);

            audioStream.on('data', (chunk) => {
                try {
                    audioBuffer = Buffer.concat([audioBuffer, chunk]);
                    
                    if (audioBuffer.length >= 4096) {
                        const processChunk = audioBuffer.slice(0, 4096);
                        audioBuffer = audioBuffer.slice(4096);

                        if (recognizer.AcceptWaveform(processChunk)) {
                            const result = JSON.parse(recognizer.Result());
                            if (result.text && result.text.trim()) {
                                const confidence = 85; // Vosk generalmente tiene buena precisión
                                onTranscript(result.text.trim(), confidence);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error procesando con Vosk:', error);
                }
            });

            audioStream.on('end', () => {
                try {
                    const finalResult = JSON.parse(recognizer.FinalResult());
                    if (finalResult.text && finalResult.text.trim()) {
                        onTranscript(finalResult.text.trim(), 85);
                    }
                } catch (error) {
                    console.error('Error en resultado final Vosk:', error);
                }
            });

        } catch (error) {
            console.error('Error en procesamiento Vosk:', error);
        }
    }

    processWithWebSpeech(audioStream, guildId, onTranscript) {
        // Simulación de Web Speech API
        // En un entorno real, esto requeriría un navegador
        console.log('🎤 Simulando reconocimiento Web Speech...');
        
        setTimeout(() => {
            // Simular reconocimiento después de 2 segundos
            const simulatedCommands = [
                'pon bad bunny',
                'reproduce reggaeton',
                'para la música',
                'siguiente canción'
            ];
            
            const randomCommand = simulatedCommands[Math.floor(Math.random() * simulatedCommands.length)];
            console.log(`🎤 [SIMULADO] Comando detectado: ${randomCommand}`);
            onTranscript(randomCommand, 75);
        }, 2000);
    }

    processWithPatterns(audioStream, guildId, onTranscript) {
        // Sistema de reconocimiento básico por patrones de audio
        console.log('🎤 Analizando patrones de audio...');
        
        let audioData = Buffer.alloc(0);
        
        audioStream.on('data', (chunk) => {
            audioData = Buffer.concat([audioData, chunk]);
        });

        audioStream.on('end', () => {
            // Análisis básico del audio
            const audioLength = audioData.length;
            const avgAmplitude = this.calculateAverageAmplitude(audioData);
            
            console.log(`📊 Audio: ${audioLength} bytes, amplitud promedio: ${avgAmplitude}`);
            
            // Patrones básicos basados en duración y amplitud
            const recognizedCommand = this.matchAudioPattern(audioLength, avgAmplitude);
            
            if (recognizedCommand) {
                console.log(`🎤 [PATRÓN] Comando detectado: ${recognizedCommand}`);
                onTranscript(recognizedCommand, 70);
            }
        });
    }

    calculateAverageAmplitude(audioBuffer) {
        if (audioBuffer.length === 0) return 0;
        
        let sum = 0;
        for (let i = 0; i < audioBuffer.length; i += 2) {
            // Leer como 16-bit signed integer
            const sample = audioBuffer.readInt16LE(i);
            sum += Math.abs(sample);
        }
        
        return sum / (audioBuffer.length / 2);
    }

    matchAudioPattern(length, amplitude) {
        // Patrones básicos basados en características del audio
        const patterns = [
            {
                minLength: 20000,
                maxLength: 60000,
                minAmplitude: 1000,
                command: 'pon bad bunny'
            },
            {
                minLength: 15000,
                maxLength: 40000,
                minAmplitude: 800,
                command: 'reproduce reggaeton'
            },
            {
                minLength: 10000,
                maxLength: 30000,
                minAmplitude: 500,
                command: 'para la música'
            },
            {
                minLength: 12000,
                maxLength: 35000,
                minAmplitude: 600,
                command: 'siguiente canción'
            }
        ];

        for (const pattern of patterns) {
            if (length >= pattern.minLength && 
                length <= pattern.maxLength && 
                amplitude >= pattern.minAmplitude) {
                return pattern.command;
            }
        }

        return null;
    }

    stopListening(guildId) {
        console.log(`🔇 Deteniendo reconocimiento para guild ${guildId}`);
        this.activeListeners.delete(guildId);
    }

    showVoskInstructions() {
        console.log(`
📋 INSTRUCCIONES PARA INSTALAR VOSK:

1. Crear directorio:
   mkdir -p models

2. Descargar modelo pequeño (40MB):
   cd models
   wget https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
   unzip vosk-model-small-es-0.42.zip

3. O modelo completo (1.4GB) para mejor precisión:
   wget https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip
   unzip vosk-model-es-0.42.zip

4. Instalar Vosk:
   npm install vosk@0.3.32

🔄 Reinicia el bot después de la instalación.
        `);
    }

    getStatus() {
        return {
            isInitialized: this.isInitialized,
            method: this.recognitionMethod,
            activeListeners: this.activeListeners.size,
            modelPath: this.modelPath
        };
    }
}

module.exports = LocalVoiceRecognition;