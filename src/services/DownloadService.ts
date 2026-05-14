import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import PagalworldService from './PagalworldService';
import { Track } from '../store/playerStore';
import { Alert } from 'react-native';

class DownloadService {
    async downloadTrack(track: Track) {
        try {
            if ((track.source !== 'pagalworld' || !track.pagalworld_url) && 
                (track.source !== 'pagalfree' || !track.pagalfree_url)) {
                Alert.alert('Download Not Supported', 'Currently only Pagalworld and Pagalfree tracks can be downloaded locally.');
                return;
            }

            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'We need storage permission to save the song.');
                return;
            }

            // 1. Get metadata for the direct URL
            let downloadUrl = '';
            let fileName = '';

            if (track.source === 'pagalworld' && track.pagalworld_url) {
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
            }

            const fileUri = `${FileSystem.documentDirectory}${fileName}`;

            console.log('[DownloadService] Starting download:', downloadUrl);
            
            // 2. Download to local app storage
            const downloadRes = await FileSystem.downloadAsync(downloadUrl, fileUri);
            
            if (downloadRes.status !== 200) {
                throw new Error('Download failed with status ' + downloadRes.status);
            }

            // 3. Save to Media Library (Music folder)
            const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
            const album = await MediaLibrary.getAlbumAsync('Knot Music');
            
            if (album === null) {
                await MediaLibrary.createAlbumAsync('Knot Music', asset, false);
            } else {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }

            Alert.alert('Success', `${track.title} saved to your device!`);
            console.log('[DownloadService] Download complete:', downloadRes.uri);
            
        } catch (error) {
            console.error('[DownloadService] Error:', error);
            Alert.alert('Download Failed', (error as Error).message);
        }
    }
}

export default new DownloadService();
