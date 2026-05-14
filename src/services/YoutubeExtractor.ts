/**
 * YoutubeExtractor — Client-side YouTube audio stream extraction.
 *
 * Mimics how apps like NewPipe / BlackHole work:
 * 1. Fetch the YouTube watch page HTML from the user's phone (residential IP).
 * 2. Extract `ytInitialPlayerResponse` JSON embedded in the page.
 * 3. Get audio stream URLs from `streamingData.adaptiveFormats`.
 * 4. If URLs are cipher-protected, download the player JS, extract the
 *    decipher function, and decode the signatures client-side.
 *
 * Because this runs on the user's phone with a residential/mobile IP,
 * YouTube treats it like a normal browser visit and does NOT block it.
 */

import { useExtractorStore } from '../store/extractorStore';

const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// ─── Caches ──────────────────────────────────────────────
// Stream URL cache (per video, 2 h TTL)
const urlCache = new Map<string, { url: string; expires: number }>();
// Decipher-actions cache (per player JS URL — almost never changes)
let cachedActions: { playerUrl: string; actions: DecipherAction[] } | null = null;

type DecipherAction =
  | { type: 'reverse' }
  | { type: 'splice'; pos: number }
  | { type: 'swap'; pos: number };

// ─── Public API ──────────────────────────────────────────
export class YoutubeExtractor {

  /** Main entry — returns a playable audio URL or null. */
  static async extract(videoId: string): Promise<string | null> {
    // 1. Check cache
    const cached = urlCache.get(videoId);
    if (cached && cached.expires > Date.now()) {
      console.log(`[YoutubeExtractor] Cache hit for ${videoId}`);
      return cached.url;
    }

    console.log(`[YoutubeExtractor] Extracting ${videoId} via Headless WebView...`);

    try {
      // 2. Request extraction via the globally mounted WebView
      const { streamingData, playerJsUrl } = await useExtractorStore.getState().requestExtraction(videoId);

      if (!streamingData) {
        console.warn('[YoutubeExtractor] No streamingData in player response');
        return null;
      }

      // 3. Collect all audio formats
      const allFormats = [
        ...(streamingData.adaptiveFormats || []),
        ...(streamingData.formats || []),
      ];
      const audioFormats = allFormats.filter(
        (f: any) => f.mimeType?.includes('audio'),
      );

      if (audioFormats.length === 0) {
        console.warn('[YoutubeExtractor] No audio formats found');
        return null;
      }

      // 4a. Try direct URLs first (no cipher)
      const directFormats = audioFormats
        .filter((f: any) => f.url && !f.signatureCipher)
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

      if (directFormats.length > 0) {
        const url = directFormats[0].url;
        console.log(`[YoutubeExtractor] Got direct audio URL for ${videoId}`);
        cacheUrl(videoId, url);
        return url;
      }

      // 4b. Cipher-protected — need to decipher
      const ciphered = audioFormats
        .filter((f: any) => f.signatureCipher || f.cipher)
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

      if (ciphered.length === 0) {
        console.warn('[YoutubeExtractor] No direct or ciphered audio URLs');
        return null;
      }

      console.log(`[YoutubeExtractor] Found ${ciphered.length} ciphered formats, deciphering...`);

      if (!playerJsUrl) {
        console.warn('[YoutubeExtractor] Could not find player JS URL from WebView payload');
        return null;
      }

      const actions = await getDecipherActions(playerJsUrl);
      if (!actions || actions.length === 0) {
        console.warn('[YoutubeExtractor] Could not extract decipher actions');
        return null;
      }

      // 5. Decipher the best format
      const bestCipher = ciphered[0].signatureCipher || ciphered[0].cipher;
      const decipheredUrl = decipherUrl(bestCipher, actions);

      if (decipheredUrl) {
        console.log(`[YoutubeExtractor] Successfully deciphered URL for ${videoId}`);
        cacheUrl(videoId, decipheredUrl);
        return decipheredUrl;
      }

      return null;
    } catch (err) {
      console.error(`[YoutubeExtractor] Error extracting ${videoId}:`, err);
      return null;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

/** Fetch player JS and extract decipher actions. Cached per player URL. */
async function getDecipherActions(playerUrl: string): Promise<DecipherAction[]> {
  if (cachedActions && cachedActions.playerUrl === playerUrl) {
    return cachedActions.actions;
  }

  console.log(`[YoutubeExtractor] Fetching player JS for decipher...`);
  const js = await fetchPage(playerUrl);
  const actions = parseDecipherActions(js);
  if (actions.length > 0) {
    cachedActions = { playerUrl, actions };
  }
  return actions;
}

/**
 * Parse the decipher function from the player JS using a robust 3-step regex approach.
 */
function parseDecipherActions(js: string): DecipherAction[] {
  // Step A: Find the Main Function Name
  // e.g. Xy = function(a){a=a.split("");...
  const functionNameRegex = /(?:\b|[^a-zA-Z0-9$])([a-zA-Z0-9$]{2,})\s*=\s*function\(\s*a\s*\)\s*\{\s*a\s*=\s*a\.split\(\s*""\s*\)/;
  const funcNameMatch = js.match(functionNameRegex);
  
  if (!funcNameMatch) {
    console.warn('[YoutubeExtractor] Could not find decipher function name');
    return [];
  }
  const funcName = funcNameMatch[1];
  console.log(`[YoutubeExtractor] Found decipher function name: ${funcName}`);

  // Step B: Extract the Main Function Body
  const functionBodyRegex = new RegExp(`${funcName.replace(/\$/g, '\\$')}\\s*=\\s*function\\([\\w$]+\\)\\s*{([\\s\\S]*?)}`);
  const funcBodyMatch = js.match(functionBodyRegex);
  
  if (!funcBodyMatch) {
    console.warn('[YoutubeExtractor] Could not find decipher function body');
    return [];
  }
  const body = funcBodyMatch[1];

  // Look for the helper object name inside the body (e.g. M0.Lp(a, 61))
  const helperMatch = body.match(/([a-zA-Z0-9$]+)\.[a-zA-Z0-9$]+\(a,\d+\)/);
  if (!helperMatch) {
    console.warn('[YoutubeExtractor] Could not find helper object in body');
    return [];
  }
  const helperName = helperMatch[1].replace(/\$/g, '\\$');

  // Step C: Extract the Helper Object Definition
  const objectDefinitionRegex = new RegExp(`var\\s+${helperName}\\s*=\\s*\\{([\\s\\S]*?)\\};`);
  const objMatch = js.match(objectDefinitionRegex);
  
  if (!objMatch) {
    console.warn('[YoutubeExtractor] Could not find helper object definition');
    return [];
  }
  const helperBody = objMatch[1];

  // Map each method in the helper object to its action type based on keywords in its body
  const methodMap = new Map<string, 'reverse' | 'splice' | 'swap'>();
  const methods = helperBody.split(/,\s*(?=[a-zA-Z0-9$]+\s*:)/);
  
  for (const method of methods) {
    const nameMatch = method.match(/^([a-zA-Z0-9$]+)\s*:/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    if (method.includes('reverse')) {
      methodMap.set(name, 'reverse');
    } else if (method.includes('splice')) {
      methodMap.set(name, 'splice');
    } else if (method.includes('%') || method.includes('var c=') || method.includes('a[0]')) {
      methodMap.set(name, 'swap');
    }
  }

  // Parse the actual call sequence from the decipher function body
  const actions: DecipherAction[] = [];
  const callRegex = new RegExp(`${helperName}\\.([a-zA-Z0-9$]+)\\([a-zA-Z0-9$]+,(\\d+)\\)|${helperName}\\.([a-zA-Z0-9$]+)\\([a-zA-Z0-9$]+\\)`, 'g');
  
  let match;
  while ((match = callRegex.exec(body)) !== null) {
    const methodName = match[1] || match[3];
    const arg = match[2] ? parseInt(match[2], 10) : 0;
    const actionType = methodMap.get(methodName);
    
    if (!actionType) continue;

    switch (actionType) {
      case 'reverse':
        actions.push({ type: 'reverse' });
        break;
      case 'splice':
        actions.push({ type: 'splice', pos: arg });
        break;
      case 'swap':
        actions.push({ type: 'swap', pos: arg });
        break;
    }
  }

  console.log(`[YoutubeExtractor] Extracted ${actions.length} decipher actions`);
  return actions;
}

/** Apply decipher actions to a signature string. */
function decipherSignature(sig: string, actions: DecipherAction[]): string {
  let arr = sig.split('');
  for (const action of actions) {
    switch (action.type) {
      case 'reverse':
        arr.reverse();
        break;
      case 'splice':
        arr.splice(0, action.pos);
        break;
      case 'swap': {
        const pos = action.pos % arr.length;
        const tmp = arr[0];
        arr[0] = arr[pos];
        arr[pos] = tmp;
        break;
      }
    }
  }
  return arr.join('');
}

/** Parse a signatureCipher string and return the deciphered URL. */
function decipherUrl(cipherStr: string, actions: DecipherAction[]): string | null {
  try {
    const params = new URLSearchParams(cipherStr);
    const encodedUrl = params.get('url');
    const sig = params.get('s');
    const sp = params.get('sp') || 'signature';

    if (!encodedUrl || !sig) return null;

    const decipheredSig = decipherSignature(decodeURIComponent(sig), actions);
    const url = new URL(decodeURIComponent(encodedUrl));
    url.searchParams.set(sp, decipheredSig);

    return url.toString();
  } catch (err) {
    console.error('[YoutubeExtractor] Decipher URL failed:', err);
    return null;
  }
}

function cacheUrl(videoId: string, url: string) {
  urlCache.set(videoId, { url, expires: Date.now() + 2 * 60 * 60 * 1000 });
}
