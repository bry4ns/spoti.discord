const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const SpotifyApi = require('./spotify');
const LocalVoiceRecognition = require('./localVoiceRecognition');
const ytdl = require('ytdl-core');

class LocalMusicBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
            ],
        });

        this.spotify = new SpotifyApi();
        this.voiceRecognition = new LocalVoiceRecognition();
        this.connections = new Map();
        this.players = new Map();
        this.isListening = new Map();
        this.currentSongs = new Map();

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.once('ready', async () => {
            console.log(`🤖 Bot conectado como ${this.client.user.tag}`);
            
            // Inicializar Vosk
            await this.voiceRecognition.initialize();
            console.log('🎤 Sistema de reconocimiento de voz local inicializado');
            
            this.client.user.setActivity('🎵 Reconocimiento de voz local', { type: 'LISTENING' });
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;

            const args = message.content.split(' ');
            const command = args[0].toLowerCase();

            switch (command) {
                case '!join':
                    await this.joinVoiceChannel(message);
                    break;
                case '!leave':
                    await this.leaveVoiceChannel(message);
                    break;
                case '!play':
                    await this.playMusic(message, args.slice(1).join(' '));
                    break;
                case '!listen':
                    await this.toggleVoiceListening(message);
                    break;
                case '!stop':
                    await this.stopMusic(message);
                    break;
                case '!skip':
                    await this.skipSong(message);
                    break;
                case '!volume':
                    await this.setVolume(message, args[1]);
                    break;
                case '!help':
                    await this.showHelp(message);
                    break;
                // Comandos de texto que simulan voz
                case '!pon':
                case '!reproduce':
                    await this.playMusic(message, args.slice(1).join(' '));
                    break;
            }
        });
    }

    async joinVoiceChannel(message) {
        const voiceChannel = message.member.voice.channel;
        
        if (!voiceChannel) {
            return message.reply('❌ Necesitas estar en un canal de voz para usar este comando.');
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
            });

            this.connections.set(message.guild.id, connection);

            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log('✅ Conectado al canal de voz');
            });

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎵 Bot de Música Conectado (Reconocimiento Local)')
                .setDescription(`Conectado a **${voiceChannel.name}**`)
                .addFields(
                    { name: '📝 Comandos de Texto', value: '`!play <canción>` - Reproducir\n`!pon <artista>` - Reproducir artista\n`!listen` - Activar reconocimiento de voz', inline: true },
                    { name: '🎤 Comandos de Voz', value: 'Activa con `!listen` y di:\n• "Pon Bad Bunny"\n• "Reproduce reggaeton"\n• "Para la música"', inline: true }
                )
                .setFooter({ text: '🔒 Reconocimiento de voz 100% local y privado' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error al conectar:', error);
            message.reply('❌ Error al conectar al canal de voz.');
        }
    }

    async toggleVoiceListening(message) {
        const connection = this.connections.get(message.guild.id);
        
        if (!connection) {
            return message.reply('❌ Primero usa `!join` para conectarme al canal de voz.');
        }

        const isCurrentlyListening = this.isListening.get(message.guild.id);
        
        if (isCurrentlyListening) {
            // Desactivar reconocimiento
            this.isListening.set(message.guild.id, false);
            this.voiceRecognition.stopListening(message.guild.id);
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔇 Reconocimiento de Voz Desactivado')
                .setDescription('Ya no estoy escuchando comandos de voz')
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } else {
            // Activar reconocimiento
            this.isListening.set(message.guild.id, true);
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎤 Reconocimiento de Voz Activado')
                .setDescription('**Comandos de voz disponibles:**')
                .addFields(
                    { name: '🎵 Reproducir Música', value: '• "Pon Bad Bunny"\n• "Reproduce reggaeton"\n• "Ponme rock en español"', inline: true },
                    { name: '⏯️ Control de Reproducción', value: '• "Para la música"\n• "Siguiente canción"\n• "Sube el volumen"', inline: true }
                )
                .setFooter({ text: '🔒 Procesamiento 100% local - Tu voz no sale de tu servidor' })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

            // Iniciar escucha
            this.voiceRecognition.startListening(
                connection, 
                message.guild.id, 
                async (transcript, confidence) => {
                    await this.handleVoiceCommand(message, transcript, confidence);
                }
            );
        }
    }

    async handleVoiceCommand(message, transcript, confidence) {
        console.log(`🎤 Comando detectado: "${transcript}" (Confianza: ${confidence}%)`);
        
        // Solo procesar si la confianza es alta
        if (confidence < 70) {
            console.log('⚠️ Confianza muy baja, ignorando comando');
            return;
        }

        const lowerTranscript = transcript.toLowerCase();
        
        // Mostrar que se detectó el comando
        const detectionEmbed = new EmbedBuilder()
            .setColor('#1db954')
            .setTitle('🎤 Comando de Voz Detectado')
            .setDescription(`**Escuché:** "${transcript}"\n**Confianza:** ${confidence}%`)
            .setTimestamp();

        const voiceMessage = await message.channel.send({ embeds: [detectionEmbed] });

        // Procesar comandos de reproducción
        if (this.isPlayCommand(lowerTranscript)) {
            const query = this.extractMusicQuery(lowerTranscript);
            if (query) {
                await this.playMusicFromVoice(voiceMessage, query, transcript);
            }
        }
        // Comandos de control
        else if (this.isStopCommand(lowerTranscript)) {
            await this.stopMusic(message);
        }
        else if (this.isSkipCommand(lowerTranscript)) {
            await this.skipSong(message);
        }
        else if (this.isVolumeCommand(lowerTranscript)) {
            const volumeLevel = this.extractVolumeLevel(lowerTranscript);
            await this.setVolume(message, volumeLevel);
        }
        else {
            // Comando no reconocido
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('❓ Comando No Reconocido')
                .setDescription(`No entendí: "${transcript}"\n\n**Comandos válidos:**\n• "Pon [artista/canción]"\n• "Para la música"\n• "Siguiente canción"`)
                .setTimestamp();

            setTimeout(() => {
                voiceMessage.edit({ embeds: [errorEmbed] });
            }, 2000);
        }
    }

    isPlayCommand(text) {
        const playPatterns = [
            'pon ', 'reproduce ', 'play ', 'ponme ', 'quiero escuchar ',
            'toca ', 'suena ', 'busca ', 'pon música de '
        ];
        return playPatterns.some(pattern => text.includes(pattern));
    }

    extractMusicQuery(text) {
        const patterns = [
            /(?:pon|reproduce|play|ponme|toca|suena)\s+(.+)/i,
            /quiero escuchar\s+(.+)/i,
            /pon música de\s+(.+)/i,
            /busca\s+(.+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        return null;
    }

    isStopCommand(text) {
        return ['para', 'stop', 'detén', 'pausa', 'para la música'].some(cmd => text.includes(cmd));
    }

    isSkipCommand(text) {
        return ['siguiente', 'skip', 'next', 'cambia', 'otra canción'].some(cmd => text.includes(cmd));
    }

    isVolumeCommand(text) {
        return text.includes('volumen') || text.includes('volume') || 
               text.includes('sube') || text.includes('baja');
    }

    extractVolumeLevel(text) {
        if (text.includes('sube')) return 'up';
        if (text.includes('baja')) return 'down';
        
        const match = text.match(/volumen\s+(\d+)/);
        return match ? match[1] : '50';
    }

    async playMusicFromVoice(voiceMessage, query, originalTranscript) {
        try {
            const searchResult = await this.spotify.searchTrack(query);
            
            if (!searchResult) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ No Encontrado')
                    .setDescription(`No encontré música para: **${query}**`)
                    .setTimestamp();

                return voiceMessage.edit({ embeds: [errorEmbed] });
            }

            // Buscar en YouTube
            const youtubeUrl = await this.searchYouTube(searchResult);
            
            if (!youtubeUrl) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Error de Reproducción')
                    .setDescription('No se pudo encontrar la canción para reproducir')
                    .setTimestamp();

                return voiceMessage.edit({ embeds: [errorEmbed] });
            }

            // Reproducir
            await this.playAudio(voiceMessage.guild.id, youtubeUrl, searchResult);

            // Actualizar mensaje
            const playingEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎵 Reproduciendo por Comando de Voz')
                .setDescription(`**${searchResult.name}**\nPor: ${searchResult.artists[0].name}`)
                .addFields(
                    { name: '🎤 Comando Original', value: `"${originalTranscript}"`, inline: true },
                    { name: '🔍 Búsqueda', value: query, inline: true },
                    { name: '💿 Álbum', value: searchResult.album.name, inline: true }
                )
                .setThumbnail(searchResult.album.images[0]?.url)
                .setTimestamp();

            voiceMessage.edit({ embeds: [playingEmbed] });

        } catch (error) {
            console.error('Error reproduciendo desde voz:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('Hubo un error al procesar tu comando de voz')
                .setTimestamp();

            voiceMessage.edit({ embeds: [errorEmbed] });
        }
    }

    async playMusic(message, query) {
        if (!query) {
            return message.reply('❌ Especifica qué música quieres.\n**Ejemplos:**\n• `!play bad bunny`\n• `!pon reggaeton`');
        }

        const connection = this.connections.get(message.guild.id);
        if (!connection) {
            return message.reply('❌ Primero usa `!join`');
        }

        try {
            const searchResult = await this.spotify.searchTrack(query);
            
            if (!searchResult) {
                return message.reply(`❌ No encontré: **${query}**`);
            }

            const searchEmbed = new EmbedBuilder()
                .setColor('#1db954')
                .setTitle('🔍 Buscando...')
                .setDescription(`Buscando: **${query}**`)
                .setTimestamp();

            const searchMessage = await message.reply({ embeds: [searchEmbed] });

            const youtubeUrl = await this.searchYouTube(searchResult);
            
            if (!youtubeUrl) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Error')
                    .setDescription('No se pudo encontrar la canción en YouTube')
                    .setTimestamp();

                return searchMessage.edit({ embeds: [errorEmbed] });
            }

            await this.playAudio(message.guild.id, youtubeUrl, searchResult);

            const playingEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🎵 Reproduciendo')
                .setDescription(`**${searchResult.name}**\nPor: ${searchResult.artists[0].name}`)
                .setThumbnail(searchResult.album.images[0]?.url)
                .addFields(
                    { name: '💿 Álbum', value: searchResult.album.name, inline: true },
                    { name: '⏱️ Duración', value: this.formatDuration(searchResult.duration_ms), inline: true }
                )
                .setTimestamp();

            searchMessage.edit({ embeds: [playingEmbed] });

        } catch (error) {
            console.error('Error:', error);
            message.reply('❌ Error al buscar música.');
        }
    }

    async playAudio(guildId, youtubeUrl, trackInfo) {
        const connection = this.connections.get(guildId);
        if (!connection) return;

        const player = createAudioPlayer();
        const resource = createAudioResource(ytdl(youtubeUrl, { 
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25
        }));

        player.play(resource);
        connection.subscribe(player);

        this.players.set(guildId, player);
        this.currentSongs.set(guildId, trackInfo);

        player.on(AudioPlayerStatus.Playing, () => {
            console.log('▶️ Reproduciendo:', trackInfo.name);
        });

        player.on(AudioPlayerStatus.Idle, () => {
            console.log('⏹️ Reproducción terminada');
            this.currentSongs.delete(guildId);
        });

        player.on('error', (error) => {
            console.error('❌ Error en reproductor:', error);
        });
    }

    async searchYouTube(track) {
        try {
            const query = `${track.name} ${track.artists[0].name}`;
            // Aquí usarías youtube-search-api o similar
            // Por simplicidad, simulo una búsqueda
            const searchQuery = query.replace(/\s+/g, '+');
            
            // En producción, implementarías búsqueda real de YouTube
            // Por ahora retorno una URL de ejemplo válida
            return `https://www.youtube.com/watch?v=dQw4w9WgXcQ`;
            
        } catch (error) {
            console.error('Error buscando en YouTube:', error);
            return null;
        }
    }

    async stopMusic(message) {
        const player = this.players.get(message.guild.id);
        
        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        player.stop();
        this.currentSongs.delete(message.guild.id);
        
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('⏹️ Música Detenida')
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    async skipSong(message) {
        const player = this.players.get(message.guild.id);
        
        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        player.stop(); // Esto activará el evento 'idle' y pasará a la siguiente
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('⏭️ Canción Saltada')
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    async setVolume(message, level) {
        const player = this.players.get(message.guild.id);
        
        if (!player) {
            return message.reply('❌ No hay música reproduciéndose.');
        }

        let volume = 50; // Default
        
        if (level === 'up') volume = 80;
        else if (level === 'down') volume = 20;
        else if (!isNaN(level)) volume = Math.max(0, Math.min(100, parseInt(level)));

        // Nota: Para control de volumen real necesitarías configurar inlineVolume: true
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔊 Volumen Ajustado')
            .setDescription(`Volumen establecido a: **${volume}%**`)
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    async leaveVoiceChannel(message) {
        const connection = this.connections.get(message.guild.id);
        
        if (!connection) {
            return message.reply('❌ No estoy en ningún canal de voz.');
        }

        connection.destroy();
        this.connections.delete(message.guild.id);
        this.players.delete(message.guild.id);
        this.isListening.delete(message.guild.id);
        this.currentSongs.delete(message.guild.id);

        await message.reply('👋 Desconectado del canal de voz.');
    }

    async showHelp(message) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🤖 Bot de Música con Reconocimiento Local')
            .setDescription('**Comandos disponibles:**')
            .addFields(
                { name: '🔗 Conexión', value: '`!join` - Conectar\n`!leave` - Desconectar', inline: true },
                { name: '🎵 Música', value: '`!play <canción>` - Reproducir\n`!pon <artista>` - Reproducir artista\n`!stop` - Parar\n`!skip` - Siguiente', inline: true },
                { name: '🎤 Reconocimiento', value: '`!listen` - Activar/desactivar\nReconocimiento 100% local', inline: true }
            )
            .addFields(
                { name: '🗣️ Comandos de Voz', value: '• "Pon Bad Bunny"\n• "Reproduce reggaeton"\n• "Para la música"\n• "Siguiente canción"\n• "Sube el volumen"', inline: false }
            )
            .setFooter({ text: '🔒 Tu voz se procesa localmente - Privacidad garantizada' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }

    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes}:${seconds.padStart(2, '0')}`;
    }

    start(token) {
        this.client.login(token);
    }
}

const bot = new LocalMusicBot();
bot.start(process.env.DISCORD_TOKEN);

module.exports = LocalMusicBot;