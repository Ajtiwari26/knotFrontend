import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useExtractorStore } from '@/src/store/extractorStore';

export const HeadlessYoutubeExtractor = () => {
  const webViewRef = useRef<WebView>(null);
  const { videoId, extracting, completeExtraction, failExtraction } = useExtractorStore();

  const INJECTED_JS = `
    (function() {
      try {
        let attempts = 0;
        const checkReady = setInterval(() => {
          if (window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.streamingData) {
            clearInterval(checkReady);
            
            // Find the player base.js URL to help with deciphering if needed
            let playerJsUrl = null;
            const html = document.documentElement.innerHTML;
            const m1 = html.match(/"jsUrl"\s*:\s*"([^"]+base\\.js)"/);
            if (m1) {
              playerJsUrl = 'https://www.youtube.com' + m1[1];
            } else {
              const m2 = html.match(/<script\\s+src="([^"]+)"[^>]*name="player_ias\\/base"/);
              if (m2) {
                playerJsUrl = 'https://www.youtube.com' + m2[1];
              } else {
                const m3 = html.match(/\\/s\\/player\\/[a-zA-Z0-9]+\\/player_ias\\.vflset\\/[a-zA-Z_]+\\/base\\.js/);
                if (m3) {
                  playerJsUrl = 'https://www.youtube.com' + m3[0];
                }
              }
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SUCCESS',
              data: window.ytInitialPlayerResponse.streamingData,
              playerJsUrl: playerJsUrl
            }));
          }
          
          attempts++;
          if (attempts > 100) { // 10 seconds timeout
            clearInterval(checkReady);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              message: 'Timeout waiting for ytInitialPlayerResponse. This might be a CAPTCHA page.'
            }));
          }
        }, 100);
      } catch (e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ERROR',
          message: e.message
        }));
      }
    })();
    true;
  `;

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'SUCCESS') {
        completeExtraction(payload.data, payload.playerJsUrl);
      } else {
        failExtraction(new Error(payload.message));
      }
    } catch (e) {
      failExtraction(e);
    }
  };

  // Keep WebView mounted to reduce Chromium engine startup latency.
  // Navigate to about:blank when idle.
  const targetUri = (extracting && videoId) ? `https://m.youtube.com/watch?v=${videoId}` : 'about:blank';

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ uri: targetUri }}
        injectedJavaScript={INJECTED_JS}
        onMessage={onMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
        incognito={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hidden: {
    height: 0,
    width: 0,
    opacity: 0,
    position: 'absolute',
    top: -1000,
    left: -1000,
  }
});
