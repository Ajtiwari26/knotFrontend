import { getBaseUrl } from '../config/api';

export interface JiosaavnSong {
    title: string;
    token: string;
    url: string;
    imageUrl?: string;
    artist?: string;
    description?: string;
}

export interface JiosaavnMetadata {
    title: string;
    artist: string;
    album?: string;
    imageUrl?: string;
    duration_ms: number;
    downloadLinks: {
        quality: string;
        url: string;
    }[];
}

class JiosaavnService {
    async search(query: string): Promise<JiosaavnSong[]> {
        try {
            const baseUrl = getBaseUrl();
            const url = `${baseUrl}/api/songs/jiosaavn/search?q=${encodeURIComponent(query)}`;
            console.log('[JiosaavnService] Fetching:', url);
            const response = await fetch(url);
            if (!response.ok) {
                console.error('[JiosaavnService] Search Failed Status:', response.status);
                throw new Error('Search failed');
            }
            return await response.json();
        } catch (error) {
            console.error('[JiosaavnService] Search Error:', error);
            return [];
        }
    }

    async getMetadata(token: string): Promise<JiosaavnMetadata | null> {
        try {
            const baseUrl = getBaseUrl();
            const url = `${baseUrl}/api/songs/jiosaavn/metadata?token=${encodeURIComponent(token)}`;
            console.log('[JiosaavnService] Metadata Fetching:', url);
            const response = await fetch(url);
            if (!response.ok) throw new Error('Metadata fetch failed');
            return await response.json();
        } catch (error) {
            console.error('[JiosaavnService] Metadata Error:', error);
            return null;
        }
    }

    getStreamUrl(directUrl: string): string {
        const baseUrl = getBaseUrl();
        return `${baseUrl}/api/songs/jiosaavn/stream?url=${encodeURIComponent(directUrl)}`;
    }
}

export default new JiosaavnService();
