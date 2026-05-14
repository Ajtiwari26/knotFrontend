import { getBaseUrl } from '../config/api';

export interface PagalworldSong {
    title: string;
    url: string;
    imageUrl?: string;
    artist?: string;
}

export interface SongMetadata {
    title?: string;
    artist?: string;
    year: string;
    month: string;
    file: string;
    downloadUrl: string;
    bitrate: string;
}

class PagalworldService {
    async search(query: string): Promise<PagalworldSong[]> {
        try {
            const baseUrl = getBaseUrl();
            const url = `${baseUrl}/api/songs/pagalworld/search?q=${encodeURIComponent(query)}`;
            console.log('[PagalworldService] Fetching:', url);
            const response = await fetch(url);
            if (!response.ok) {
                console.error('[PagalworldService] Search Failed Status:', response.status);
                throw new Error('Search failed');
            }
            return await response.json();
        } catch (error) {
            console.error('[PagalworldService] Search Error:', error);
            return [];
        }
    }

    async getMetadata(songUrl: string): Promise<SongMetadata | null> {
        try {
            const baseUrl = getBaseUrl();
            const response = await fetch(`${baseUrl}/api/songs/pagalworld/metadata?url=${encodeURIComponent(songUrl)}`);
            if (!response.ok) throw new Error('Metadata fetch failed');
            return await response.json();
        } catch (error) {
            console.error('[PagalworldService] Metadata Error:', error);
            return null;
        }
    }

    getStreamUrl(metadata: SongMetadata): string {
        const baseUrl = getBaseUrl();
        return `${baseUrl}/api/songs/pagalworld/stream?year=${metadata.year}&month=${metadata.month}&file=${encodeURIComponent(metadata.file)}`;
    }
}

export default new PagalworldService();
