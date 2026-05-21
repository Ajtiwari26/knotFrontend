import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import PagalworldService from './PagalworldService';
import { Track } from '../store/playerStore';
import { Alert, Platform } from 'react-native';
import { getBaseUrl } from '../config/api';
import { KnotService } from './KnotService';
import AsyncStorage from '@react-native-async-storage/async-storage';

class DownloadService {
    private activeDownloads = new Set<string>();

    async downloadTrack(track: Track) {
        const songKey = track.youtube_id || track.pagalworld_url || track.pagalfree_url || track.jiosaavn_token;
        if (!songKey) {
            Alert.alert('Error', 'Missing track identifier.');
            return;
        }

        if (this.activeDownloads.has(songKey)) {
            Alert.alert('Downloading', 'This song is already downloading.');
            return;
        }

        try {
            // Check if already downloaded in AsyncStorage
            const downloadedTrackKey = `downloaded_track_${songKey}`;
            const existing = await AsyncStorage.getItem(downloadedTrackKey);
            if (existing) {
                Alert.alert('Already Downloaded', 'This song is already saved on your device.');
                return;
            }

            // Check if track source is supported
            if (track.source !== 'pagalworld' && 
                track.source !== 'pagalfree' && 
                track.source !== 'youtube' &&
                track.source !== 'jiosaavn') {
                Alert.alert('Download Not Supported', 'Only YouTube, Pagalworld, Pagalfree, and JioSaavn tracks can be downloaded.');
                return;
            }

            this.activeDownloads.add(songKey);

            // Check permissions (should already be granted/requested at app startup)
            const permGranted = await MediaLibrary.getPermissionsAsync();
            if (!permGranted.granted) {
                console.log('[DownloadService] MediaLibrary permission not granted. Saving to private storage only.');
            }

            Alert.alert('Downloading', `Downloading ${track.title}...`);

            // 1. Get metadata for the direct URL
            let downloadUrl = '';
            let fileName = '';

            if (track.source === 'youtube' && track.youtube_id) {
                // For YouTube, use backend to get download URL
                const baseUrl = getBaseUrl();
                const response = await fetch(`${baseUrl}/api/songs/youtube/download?youtube_id=${track.youtube_id}`);
                
                if (!response.ok) {
                    throw new Error('Failed to get YouTube download link');
                }
                
                const data = await response.json();
                downloadUrl = data.downloadUrl;
                fileName = `${track.title.replace(/[^a-z0-9]/gi, '_')}.m4a`;
                
            } else if (track.source === 'pagalworld' && track.pagalworld_url) {
                const metadata = await PagalworldService.getMetadata(track.pagalworld_url);
                if (!metadata) throw new Error('Failed to get Pagalworld download link');
                downloadUrl = metadata.downloadUrl;
                fileName = metadata.file;
                
            } else if (track.source === 'pagalfree' && track.pagalfree_url) {
                const PagalfreeService = require('./PagalfreeService').default;
                const metadata = await PagalfreeService.getMetadata(track.pagalfree_url);
                if (!metadata || metadata.downloadLinks.length === 0) throw new Error('Failed to get Pagalfree download link');
                
                const bestLink = metadata.downloadLinks.find((l: any) => l.quality === '320kbps') || 
                                 metadata.downloadLinks.find((l: any) => l.quality === '128kbps') || 
                                 metadata.downloadLinks[0];
                downloadUrl = bestLink.url;
                fileName = `${metadata.title.replace(/[^a-z0-9]/gi, '_')}.mp3`;
            } else if (track.source === 'jiosaavn' && track.jiosaavn_token) {
                const JiosaavnService = require('./JiosaavnService').default;
                const metadata = await JiosaavnService.getMetadata(track.jiosaavn_token);
                if (!metadata || metadata.downloadLinks.length === 0) throw new Error('Failed to get JioSaavn download link');
                
                const bestLink = metadata.downloadLinks.find((l: any) => l.quality === '320kbps') || 
                                 metadata.downloadLinks.find((l: any) => l.quality === '160kbps') || 
                                 metadata.downloadLinks[0];
                downloadUrl = JiosaavnService.getStreamUrl(bestLink.url);
                fileName = `${metadata.title.replace(/[^a-z0-9]/gi, '_')}.mp3`;
            } else {
                throw new Error('Invalid track source or missing URL');
            }

            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            console.log('[DownloadService] Starting download:', downloadUrl);
            
            // 2. Download to local app storage
            const { usePlayerStore } = require('../store/playerStore');
            usePlayerStore.getState().setDownloadProgress(songKey, 0.01);
            
            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                fileUri,
                {},
                (downloadProgress) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    const safeProgress = Math.max(0.01, Math.min(0.99, isNaN(progress) ? 0 : progress));
                    usePlayerStore.getState().setDownloadProgress(songKey, safeProgress);
                }
            );

            const downloadRes = await downloadResumable.downloadAsync();
            
            if (!downloadRes || downloadRes.status !== 200) {
                throw new Error('Download failed with status ' + (downloadRes ? downloadRes.status : 'unknown'));
            }

            usePlayerStore.getState().setDownloadProgress(songKey, 1.0);
            
            // 3. Save to Media Library if permission is granted
            let savedAssetUri = downloadRes.uri;
            if (permGranted.granted) {
                try {
                    console.log('[DownloadService] Saving to media library...');
                    const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
                    savedAssetUri = asset.uri;
                    
                    // Try to add to album, but don't fail if it doesn't work
                    try {
                        const album = await MediaLibrary.getAlbumAsync('Knot Music');
                        if (album === null) {
                            await MediaLibrary.createAlbumAsync('Knot Music', asset, false);
                        } else {
                            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                        }
                    } catch (albumError) {
                        console.warn('[DownloadService] Could not add to album, but file is saved:', albumError);
                    }

                    console.log('[DownloadService] Successfully saved to media library');
                } catch (mediaError) {
                    console.warn('[DownloadService] Media library save failed, keeping file in private storage:', mediaError);
                }
            } else {
                console.log('[DownloadService] MediaLibrary permission not granted, keeping file in private storage:', savedAssetUri);
            }

            // 4. Save knot metadata and track info for offline access
            try {
                const songKey = track.youtube_id || track.pagalworld_url || track.pagalfree_url || track.jiosaavn_token || fileName;
                
                // Save track metadata
                const downloadedTrackKey = `downloaded_track_${songKey}`;
                const trackMetadata = {
                    ...track,
                    local_uri: savedAssetUri,
                    filename: fileName,
                    downloadedAt: Date.now(),
                    source: track.source,
                };
                await AsyncStorage.setItem(downloadedTrackKey, JSON.stringify(trackMetadata));
                
                // If track has knots, save them under the new local keys
                const sourceKey = track.youtube_id || track.pagalworld_url || track.pagalfree_url || track.jiosaavn_token;
                if (sourceKey) {
                    const existingKnot = await KnotService.getSavedKnot(sourceKey);
                    if (existingKnot) {
                        // Associate knot with the downloaded file so it appears in knotted list
                        await KnotService.saveKnot(fileName, existingKnot);
                        await KnotService.saveKnot(savedAssetUri, existingKnot);
                        console.log('[DownloadService] Saved knot metadata for downloaded track (source:', track.source, ')');
                    }
                }
                
                // Add to recently knotted list if it has knots
                const recentlyKnottedKey = 'recently_knotted_list';
                const recentList = await AsyncStorage.getItem(recentlyKnottedKey);
                let recentArray = recentList ? JSON.parse(recentList) : [];
                
                // Add this track to the beginning
                recentArray = [trackMetadata, ...recentArray.filter((t: any) => 
                    (t.youtube_id !== track.youtube_id) && 
                    (t.local_uri !== savedAssetUri)
                )].slice(0, 50); // Keep only last 50
                
                await AsyncStorage.setItem(recentlyKnottedKey, JSON.stringify(recentArray));
                console.log('[DownloadService] Added to recently knotted list');
                
            } catch (metadataError) {
                // Ignore key/metadata write errors
                console.warn('[DownloadService] Failed to save metadata:', metadataError);
            }

            Alert.alert('Success', `${track.title} saved to your device!`);
            
        } catch (error) {
            console.error('[DownloadService] Error:', error);
            Alert.alert('Download Failed', (error as Error).message);
        } finally {
            if (songKey) {
                this.activeDownloads.delete(songKey);
                setTimeout(() => {
                    const { usePlayerStore } = require('../store/playerStore');
                    const progressMap = { ...usePlayerStore.getState().downloadProgress };
                    delete progressMap[songKey];
                    usePlayerStore.setState({ downloadProgress: progressMap });
                }, 2000);
            }
        }
    }
}

export default new DownloadService();
