import { getBaseUrl } from '../config/api';

export interface PagalfreeSong {
    title: string;
    url: string;
    imageUrl?: string;
    artist?: string;
}

export interface PagalfreeMetadata {
    title: string;
    artist: string;
    album?: string;
    imageUrl?: string;
    downloadLinks: {
        quality: string;
        url: string;
    }[];
}

class PagalfreeService {
    async search(query: string): Promise<PagalfreeSong[]> {
        try {
            const baseUrl = getBaseUrl();
            const url = `${baseUrl}/api/songs/pagalfree/search?q=${encodeURIComponent(query)}`;
            console.log('[PagalfreeService] Fetching:', url);
            const response = await fetch(url);
            if (!response.ok) {
                console.error('[PagalfreeService] Search Failed Status:', response.status);
                throw new Error('Search failed');
            }
            return await response.json();
        } catch (error) {
            console.error('[PagalfreeService] Search Error:', error);
            return [];
        }
    }

    async getMetadata(songUrl: string): Promise<PagalfreeMetadata | null> {
        try {
            const baseUrl = getBaseUrl();
            const response = await fetch(`${baseUrl}/api/songs/pagalfree/metadata?url=${encodeURIComponent(songUrl)}`);
            if (!response.ok) throw new Error('Metadata fetch failed');
            return await response.json();
        } catch (error) {
            console.error('[PagalfreeService] Metadata Error:', error);
            return null;
        }
    }

    getStreamUrl(directUrl: string): string {
        const baseUrl = getBaseUrl();
        return `${baseUrl}/api/songs/pagalfree/stream?url=${encodeURIComponent(directUrl)}`;
    }
}

export default new PagalfreeService();
