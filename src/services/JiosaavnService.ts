import { getBaseUrl } from '../config/api';

export interface JiosaavnSong {
    title: string;
    token: string;
    url: string;
    imageUrl?: string;
    artist?: string;
    description?: string;
}

export interface JiosaavnAlbumResult {
    title: string;
    token: string;
    url: string;
    imageUrl?: string;
    artist?: string;
    year?: string;
    language?: string;
    description?: string;
}

export interface JiosaavnArtistResult {
    name: string;
    token: string;
    url: string;
    imageUrl?: string;
    description?: string;
}

export interface JiosaavnSearchAllResults {
    topQuery: { type: string; item: JiosaavnSong | JiosaavnAlbumResult | JiosaavnArtistResult } | null;
    songs: JiosaavnSong[];
    albums: JiosaavnAlbumResult[];
    artists: JiosaavnArtistResult[];
}

export interface JiosaavnAlbumSong {
    title: string;
    token: string;
    url: string;
    imageUrl?: string;
    artist?: string;
    duration_ms: number;
}

export interface JiosaavnAlbumDetails {
    title: string;
    token: string;
    imageUrl?: string;
    artist?: string;
    year?: string;
    language?: string;
    songs: JiosaavnAlbumSong[];
}

export interface JiosaavnArtistDetails {
    name: string;
    token: string;
    imageUrl?: string;
    followerCount?: number;
    isVerified?: boolean;
    bio?: string;
    topSongs: JiosaavnAlbumSong[];
    topAlbums: JiosaavnAlbumResult[];
    singles: JiosaavnAlbumSong[];
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

    async searchAll(query: string): Promise<JiosaavnSearchAllResults> {
        const empty: JiosaavnSearchAllResults = { topQuery: null, songs: [], albums: [], artists: [] };
        try {
            const baseUrl = getBaseUrl();
            const url = `${baseUrl}/api/songs/jiosaavn/search/all?q=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Search failed (${response.status})`);
            const data = await response.json();
            return {
                topQuery: data.topQuery ?? null,
                songs: Array.isArray(data.songs) ? data.songs : [],
                albums: Array.isArray(data.albums) ? data.albums : [],
                artists: Array.isArray(data.artists) ? data.artists : [],
            };
        } catch (error) {
            console.error('[JiosaavnService] SearchAll Error:', error);
            return empty;
        }
    }

    async getAlbum(token: string): Promise<JiosaavnAlbumDetails | null> {
        try {
            const baseUrl = getBaseUrl();
            const url = `${baseUrl}/api/songs/jiosaavn/album?token=${encodeURIComponent(token)}`;
            const response = await fetch(url);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('[JiosaavnService] Album Error:', error);
            return null;
        }
    }

    async getArtist(token: string): Promise<JiosaavnArtistDetails | null> {
        try {
            const baseUrl = getBaseUrl();
            const url = `${baseUrl}/api/songs/jiosaavn/artist?token=${encodeURIComponent(token)}`;
            const response = await fetch(url);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('[JiosaavnService] Artist Error:', error);
            return null;
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
