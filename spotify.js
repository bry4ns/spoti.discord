const SpotifyWebApi = require('spotify-web-api-node');

class SpotifyApi {
    constructor() {
        this.spotifyApi = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        });

        this.authenticate();
    }

    async authenticate() {
        try {
            const data = await this.spotifyApi.clientCredentialsGrant();
            this.spotifyApi.setAccessToken(data.body['access_token']);
            
            console.log('✅ Autenticado con Spotify API');
            
            // Renovar token cada 50 minutos
            setTimeout(() => {
                this.authenticate();
            }, 50 * 60 * 1000);
            
        } catch (error) {
            console.error('❌ Error autenticando con Spotify:', error);
        }
    }

    async searchTrack(query) {
        try {
            // Limpiar query para mejor búsqueda
            const cleanQuery = this.cleanSearchQuery(query);
            
            const searchResults = await this.spotifyApi.searchTracks(cleanQuery, { 
                limit: 5,
                market: 'ES' // Mercado español
            });
            
            if (searchResults.body.tracks.items.length === 0) {
                // Intentar búsqueda más amplia
                const broadSearch = await this.spotifyApi.searchTracks(query, { 
                    limit: 5,
                    market: 'US'
                });
                
                if (broadSearch.body.tracks.items.length === 0) {
                    return null;
                }
                
                return this.formatTrack(broadSearch.body.tracks.items[0]);
            }

            // Retornar la mejor coincidencia
            const bestMatch = this.findBestMatch(searchResults.body.tracks.items, query);
            return this.formatTrack(bestMatch);
            
        } catch (error) {
            console.error('Error buscando en Spotify:', error);
            return null;
        }
    }

    cleanSearchQuery(query) {
        // Limpiar query de palabras comunes que pueden interferir
        const stopWords = ['pon', 'reproduce', 'play', 'música', 'canción', 'tema'];
        const words = query.toLowerCase().split(' ');
        const cleanWords = words.filter(word => !stopWords.includes(word));
        return cleanWords.join(' ').trim();
    }

    findBestMatch(tracks, originalQuery) {
        // Algoritmo simple para encontrar la mejor coincidencia
        const queryLower = originalQuery.toLowerCase();
        
        let bestScore = 0;
        let bestTrack = tracks[0];
        
        for (const track of tracks) {
            let score = 0;
            const trackName = track.name.toLowerCase();
            const artistName = track.artists[0].name.toLowerCase();
            
            // Puntuación por coincidencia en nombre
            if (trackName.includes(queryLower)) score += 10;
            if (queryLower.includes(trackName)) score += 8;
            
            // Puntuación por coincidencia en artista
            if (artistName.includes(queryLower)) score += 10;
            if (queryLower.includes(artistName)) score += 8;
            
            // Puntuación por popularidad
            score += track.popularity / 10;
            
            if (score > bestScore) {
                bestScore = score;
                bestTrack = track;
            }
        }
        
        return bestTrack;
    }

    formatTrack(track) {
        return {
            id: track.id,
            name: track.name,
            artists: track.artists,
            album: track.album,
            duration_ms: track.duration_ms,
            popularity: track.popularity,
            preview_url: track.preview_url,
            external_urls: track.external_urls,
            uri: track.uri
        };
    }

    async getArtistTopTracks(artistName) {
        try {
            // Buscar artista
            const artistSearch = await this.spotifyApi.searchArtists(artistName, { 
                limit: 1,
                market: 'ES'
            });
            
            if (artistSearch.body.artists.items.length === 0) {
                return null;
            }

            const artist = artistSearch.body.artists.items[0];
            
            // Obtener top tracks
            const topTracks = await this.spotifyApi.getArtistTopTracks(artist.id, 'ES');
            
            return topTracks.body.tracks.map(track => this.formatTrack(track));
            
        } catch (error) {
            console.error('Error obteniendo top tracks:', error);
            return null;
        }
    }

    async searchByGenre(genre) {
        try {
            // Buscar por género usando seeds
            const recommendations = await this.spotifyApi.getRecommendations({
                seed_genres: [genre.toLowerCase()],
                limit: 20,
                market: 'ES'
            });

            if (recommendations.body.tracks.length === 0) {
                // Intentar búsqueda por texto
                const textSearch = await this.spotifyApi.searchTracks(`genre:${genre}`, {
                    limit: 20,
                    market: 'ES'
                });
                
                return textSearch.body.tracks.items.map(track => this.formatTrack(track));
            }

            return recommendations.body.tracks.map(track => this.formatTrack(track));
            
        } catch (error) {
            console.error('Error buscando por género:', error);
            return null;
        }
    }

    async getRandomTrackFromArtist(artistName) {
        try {
            const topTracks = await this.getArtistTopTracks(artistName);
            if (!topTracks || topTracks.length === 0) return null;
            
            // Seleccionar track aleatorio
            const randomIndex = Math.floor(Math.random() * topTracks.length);
            return topTracks[randomIndex];
            
        } catch (error) {
            console.error('Error obteniendo track aleatorio:', error);
            return null;
        }
    }

    // Método para búsquedas inteligentes basadas en comandos de voz
    async intelligentSearch(query) {
        const lowerQuery = query.toLowerCase();
        
        // Detectar si es búsqueda por artista
        if (lowerQuery.includes('de ') || lowerQuery.includes('del ') || 
            lowerQuery.includes('por ') || lowerQuery.includes('música de')) {
            
            const artistName = this.extractArtistName(lowerQuery);
            if (artistName) {
                const randomTrack = await this.getRandomTrackFromArtist(artistName);
                if (randomTrack) return randomTrack;
            }
        }
        
        // Detectar si es búsqueda por género
        const genres = ['reggaeton', 'rock', 'pop', 'salsa', 'bachata', 'merengue', 
                       'trap', 'hip hop', 'jazz', 'blues', 'electronic', 'cumbia'];
        
        for (const genre of genres) {
            if (lowerQuery.includes(genre)) {
                const genreTracks = await this.searchByGenre(genre);
                if (genreTracks && genreTracks.length > 0) {
                    const randomIndex = Math.floor(Math.random() * Math.min(5, genreTracks.length));
                    return genreTracks[randomIndex];
                }
            }
        }
        
        // Búsqueda normal
        return await this.searchTrack(query);
    }

    extractArtistName(query) {
        const patterns = [
            /música de (.+)/,
            /canciones de (.+)/,
            /temas de (.+)/,
            /algo de (.+)/,
            /(.+) música/,
            /del (.+)/,
            /de (.+)/
        ];
        
        for (const pattern of patterns) {
            const match = query.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        return null;
    }
}

module.exports = SpotifyApi;