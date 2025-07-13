const vosk = require('vosk');
const { Transform } = require('stream');
const fs = require('fs');
const path = require('path');

class LocalVoiceRecognition {
    constructor() {
        this.model = null;
        this.recognizers = new Map();
        this.activeListeners = new Map();
        this.modelPath = './models/vosk-model-es-0.42';
    }

    async initialize() {
        try {
            // Verificar si el modelo existe
            if (!fs.existsSync(this.modelPath)) {
                console.log('📥 Modelo de voz no encontrado. Descargando...');
                await this.downloadModel();
            }

            // Cargar modelo
            console.log('🔄 Cargando modelo de reconocimiento de voz...');
            this.model = new vosk.Model(this.modelPath);
            console.log('✅ Modelo cargado exitosamente');
            
            return true;
        } catch (error) {
            console.error('❌ Error inicializando reconocimiento de voz:', error);
            return false;
        }
    }

    async downloadModel() {
        console.log(`
📋 INSTRUCCIONES PARA DESCARGAR EL MODELO:

1. Ve a: https://alphacephei.com/vosk/models
2. Descarga: "vosk-model-es-0.42" (Español, ~1.4GB)
3. Extrae el archivo en la carpeta: ./models/
4. La estructura debe ser: ./models/vosk-model-es-0.42/

Alternativamente, puedes usar el modelo pequeño (40MB):
- Descarga: "vosk-model-small-es-0.42"
- Menos preciso pero más rápido

🔄 Reinicia el bot después de descargar el modelo.
        `);
        
        throw new Error('Modelo no encontrado. Sigue las instrucciones arriba.');
    }

    startListening(connection, guildId, onTranscript) {
        if (!this.model) {
            console.error('❌ Modelo no inicializado');
            return false;
        }

        console.log(`🎤 Iniciando reconocimiento local para guild ${guildId}`);

        // Crear reconocedor para este guild
        const recognizer = new vosk.KaldiRecognizer(this.model, 16000);
        this.recognizers.set(guildId, recognizer);

        // Configurar captura de audio
        const receiver = connection.receiver;
        
        // Escuchar cuando alguien habla
        receiver.speaking.on('start', (userId) => {
            console.log(`👤 Usuario ${userId} comenzó a hablar`);
            
            // Crear stream de audio para el usuario
            const audioStream = receiver.subscribe(userId, {
                end: {
                    behavior: 'afterSilence',
                    duration: 1500, // 1.5 segundos de silencio
                },
            });

            // Procesar audio
            this.processAudioStream(audioStream, recognizer, guildId, onTranscript);
        });

        this.activeListeners.set(guildId, { connection, receiver, recognizer });
        return true;
    }

    processAudioStream(audioStream, recognizer, guildId, onTranscript) {
        // Transformar audio para Vosk
        const audioProcessor = new Transform({
            transform(chunk, encoding, callback) {
                // Convertir de Opus a PCM 16kHz mono
                // Vosk espera PCM 16-bit, 16kHz, mono
                try {
                    // Aquí necesitarías usar una librería como node-opus para decodificar
                    // Por simplicidad, paso el chunk directamente
                    // En producción, decodificarías el audio Opus primero
                    callback(null, chunk);
                } catch (error) {
                    console.error('Error procesando audio:', error);
                    callback();
                }
            }
        });

        let audioBuffer = Buffer.alloc(0);
        let silenceTimeout = null;

        audioStream.pipe(audioProcessor);

        audioProcessor.on('data', (chunk) => {
            try {
                // Acumular audio
                audioBuffer = Buffer.concat([audioBuffer, chunk]);

                // Procesar en chunks de 4096 bytes
                while (audioBuffer.length >= 4096) {
                    const processChunk = audioBuffer.slice(0, 4096);
                    audioBuffer = audioBuffer.slice(4096);

                    // Enviar a Vosk
                    if (recognizer.AcceptWaveform(processChunk)) {
                        const result = JSON.parse(recognizer.Result());
                        if (result.text && result.text.trim()) {
                            const confidence = this.calculateConfidence(result);
                            console.log(`🎤 Transcripción: "${result.text}" (${confidence}%)`);
                            onTranscript(result.text.trim(), confidence);
                        }
                    }
                }

                // Reset timeout de silencio
                if (silenceTimeout) {
                    clearTimeout(silenceTimeout);
                }
                
                silenceTimeout = setTimeout(() => {
                    // Procesar audio restante después del silencio
                    if (audioBuffer.length > 0) {
                        recognizer.AcceptWaveform(audioBuffer);
                        const finalResult = JSON.parse(recognizer.FinalResult());
                        if (finalResult.text && finalResult.text.trim()) {
                            const confidence = this.calculateConfidence(finalResult);
                            console.log(`🎤 Transcripción final: "${finalResult.text}" (${confidence}%)`);
                            onTranscript(finalResult.text.trim(), confidence);
                        }
                        audioBuffer = Buffer.alloc(0);
                    }
                }, 2000);

            } catch (error) {
                console.error('Error en reconocimiento:', error);
            }
        });

        audioProcessor.on('end', () => {
            try {
                // Procesar audio final
                if (audioBuffer.length > 0) {
                    recognizer.AcceptWaveform(audioBuffer);
                }
                
                const finalResult = JSON.parse(recognizer.FinalResult());
                if (finalResult.text && finalResult.text.trim()) {
                    const confidence = this.calculateConfidence(finalResult);
                    console.log(`🎤 Resultado final: "${finalResult.text}" (${confidence}%)`);
                    onTranscript(finalResult.text.trim(), confidence);
                }
            } catch (error) {
                console.error('Error procesando resultado final:', error);
            }
        });

        audioProcessor.on('error', (error) => {
            console.error('Error en stream de audio:', error);
        });
    }

    calculateConfidence(result) {
        // Vosk no siempre proporciona confianza directamente
        // Calculamos una estimación basada en la longitud y palabras reconocidas
        if (result.conf !== undefined) {
            return Math.round(result.conf * 100);
        }

        const text = result.text || '';
        const wordCount = text.split(' ').filter(word => word.length > 0).length;
        
        // Estimación simple de confianza
        if (wordCount === 0) return 0;
        if (wordCount === 1) return 60;
        if (wordCount <= 3) return 75;
        return 85;
    }

    stopListening(guildId) {
        console.log(`🔇 Deteniendo reconocimiento para guild ${guildId}`);
        
        const recognizer = this.recognizers.get(guildId);
        if (recognizer) {
            // Limpiar reconocedor
            this.recognizers.delete(guildId);
        }

        this.activeListeners.delete(guildId);
    }

    // Método para probar el reconocimiento con un archivo de audio
    async testWithAudioFile(audioFilePath) {
        if (!this.model) {
            console.error('❌ Modelo no inicializado');
            return null;
        }

        try {
            const recognizer = new vosk.KaldiRecognizer(this.model, 16000);
            const audioData = fs.readFileSync(audioFilePath);
            
            recognizer.AcceptWaveform(audioData);
            const result = JSON.parse(recognizer.FinalResult());
            
            console.log('🎤 Resultado de prueba:', result.text);
            return result.text;
            
        } catch (error) {
            console.error('Error en prueba:', error);
            return null;
        }
    }

    // Obtener información del modelo
    getModelInfo() {
        return {
            modelPath: this.modelPath,
            isLoaded: !!this.model,
            activeRecognizers: this.recognizers.size,
            activeListeners: this.activeListeners.size
        };
    }
}

module.exports = LocalVoiceRecognition;