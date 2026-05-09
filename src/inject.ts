import { GoogleGenAI } from '@google/genai';
import { initializeAdBar, addAnimation, removeAnimation, cleanupAll } from './bilibili-ui';
import { getVideoIdFromCurrentPage } from './util';
import { thinkingAnimationClass, warningAnimationClass } from './style';
import { showToast } from './toast';
import { fetchSubtitleString } from './subtitleFetcher';
import { identifyAdSegments, checkGeminiConnectivity } from './ai';
import { buildPrompt } from './prompt/builder';
import { config, initializeConfig, UserConfig } from './config';
import type { AdSegment, CacheEntry, RadarSignals } from './storage/cache';
import { runRadar, cleanupRadar, emptyRadarSignals } from './radar/index';

interface CacheMap {
  [bvid: string]: CacheEntry | null;
}

let geminiClient: GoogleGenAI | null = null;
let localCacheMap: CacheMap | null = null;

console.log('SAI: Inject script ready, signaling to content script');

window.postMessage({ type: 'SAI_READY' }, '*');
window.postMessage({ type: 'SAI_REQUEST_CACHE' }, '*');

const webResponseCache: { [videoBvid: string]: object } = {};
let currentVideoId: string | null = null;

// ---- postMessage bus ----

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'TOASTIFY_LOADED') {
    console.log('SAI: Toastify loaded, waiting for document.body');
    const notifyWhenBodyReady = () => {
      if (document.body) {
        console.log('SAI: document.body ready');
      } else {
        requestAnimationFrame(notifyWhenBodyReady);
      }
    };
    notifyWhenBodyReady();
    return;
  }

  if (event.data.type === 'SAI_SEND_CACHE') {
    console.log('SAI: Received cache from content.ts', event.data);
    localCacheMap = event.data.data || {};
    return;
  }

  if (event.data.type === 'SAI_CONFIG') {
    console.log('SAI: Received config', event.data);
    const receivedConfig: UserConfig = event.data.config;
    initializeConfig(receivedConfig);

    if (receivedConfig.apiKey) {
      geminiClient = new GoogleGenAI({ apiKey: receivedConfig.apiKey });
      console.log('SAI: Gemini client initialized');
    } else {
      console.log('SAI: No API key provided');
      showToast('SAI: No Gemini API key configured');
    }
  }
});

// ---- core processing ----

async function processVideoSubtitles(response: any, videoId: string): Promise<void> {
  if (!response.data?.name) {
    console.error('[SAI] User not logged in');
    showToast('SAI: Please log in to Bilibili');
    return;
  }

  const videoBvid = response.data.bvid;

  // 1. Cache lookup
  if (localCacheMap && videoId && localCacheMap[videoId]) {
    const cached = localCacheMap[videoId];
    if (cached && cached.segments.length > 0) {
      console.log('[SAI:CACHE] Hit for', videoId, '— segments:', cached.segments);
      initializeAdBar(cached.segments, config);
      return;
    } else {
      console.log('[SAI:CACHE] Hit but no segments — clean video:', videoId);
      return;
    }
  }
  console.log('[SAI:CACHE] Miss for', videoId);

  // @ts-ignore
  const videoDuration: number | undefined = window.__INITIAL_STATE__?.videoData?.duration;

  // 2. Run Radar (directly in page context, no subtitles needed)
  let radarSignals: RadarSignals = emptyRadarSignals();
  let shortCircuitSegments: AdSegment[] | undefined;

  if (config.radarEnabled) {
    console.log('[SAI:RADAR] Running radar probes...');
    try {
      const radarDecision = await runRadar(videoDuration ?? 0);
      radarSignals = radarDecision.signals;
      shortCircuitSegments = radarDecision.shortCircuitSegments;

      console.log('[SAI:RADAR] Signals:', {
        hasGoodsLink: radarSignals.hasGoodsLink,
        goodsBrand: radarSignals.goodsBrand,
        chapterHits: radarSignals.chapterHits,
        tagConflicts: radarSignals.tagConflicts,
      });

      if (shortCircuitSegments) {
        console.log('[SAI:SHORTCIRCUIT] Radar short-circuit fired — skipping AI. Segments:', shortCircuitSegments);
        window.postMessage({
          type: 'SAI_SAVE_RESULT',
          data: { bvid: videoBvid, segments: shortCircuitSegments, source: 'radar', radarSignals },
        }, '*');
        initializeAdBar(shortCircuitSegments, config);
        return;
      } else {
        console.log('[SAI:RADAR] No short-circuit — proceeding to subtitle fetch');
      }
    } catch (err) {
      console.error('[SAI:RADAR] Error running radar, falling back to AI:', err);
    }
  } else {
    console.log('[SAI:RADAR] Radar disabled — skipping');
  }

  // 3. Fetch subtitles (needed for AI)
  const subtitleStr = await fetchSubtitleString(response);
  if (!subtitleStr) {
    console.log('[SAI] No subtitles available for this video, passing through');
    addAnimation(warningAnimationClass);
    setTimeout(() => removeAnimation(), 3000);
    return;
  }

  // 4. Run AI
  if (!geminiClient || !config.aiModel) {
    console.error('[SAI:AI] Gemini client not initialized');
    return;
  }

  const connectivity = await checkGeminiConnectivity(geminiClient, config.aiModel);
  console.log('[SAI:AI] Connectivity check:', connectivity);

  // @ts-ignore
  const videoTitle: string | undefined = window.__INITIAL_STATE__?.videoData?.title;
  // @ts-ignore
  const videoDescription: string | undefined = window.__INITIAL_STATE__?.videoData?.desc;
  // @ts-ignore
  const tname: string | undefined = window.__INITIAL_STATE__?.videoData?.tname;

  const prompt = buildPrompt(subtitleStr, radarSignals, {
    title: videoTitle,
    description: videoDescription,
    tname,
  });

  console.log('[SAI:AI] Calling', config.aiModel, '— subtitle length:', subtitleStr.length, 'chars');

  let segments: AdSegment[] = [];
  try {
    addAnimation(thinkingAnimationClass);
    segments = await identifyAdSegments({ geminiClient, prompt, aiModel: config.aiModel });
    removeAnimation();
  } catch (error) {
    console.error('[SAI:AI] Error identifying ads:', error);
    removeAnimation();
    return;
  }

  console.log('[SAI:AI RESULT]', segments.length, 'segment(s):', segments);

  window.postMessage({
    type: 'SAI_SAVE_RESULT',
    data: { bvid: videoBvid, segments, source: 'ai', radarSignals },
  }, '*');

  if (segments.length > 0) {
    console.log('[SAI:UI] Initializing ad bar with', segments.length, 'segment(s)');
    initializeAdBar(segments, config);
  } else {
    console.log('[SAI:UI] No ads detected — clean video');
  }
}

// ---- XHR interception ----

(function () {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...args: any[]) {
    // @ts-ignore
    this._url = url.toString();
    // @ts-ignore
    return originalOpen.call(this, method, url, ...args);
  };

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    // @ts-ignore
    const url = this._url;

    if (
      window.location.pathname.startsWith('/video/') &&
      url &&
      url.includes('api.bilibili.com/x/player/wbi/v2')
    ) {
      console.log('SAI: Detected player API request');

      this.addEventListener('load', async function () {
        try {
          if (this.status !== 200) {
            console.error('SAI: Failed to fetch player API', this.status);
            return;
          }

          const videoId = getVideoIdFromCurrentPage();
          const response = JSON.parse(this.responseText);
          const videoBvid = response.data.bvid;
          webResponseCache[videoBvid] = response;

          if (videoBvid !== videoId) {
            return;
          }

          // @ts-ignore
          const videoDuration = window.__INITIAL_STATE__?.videoData?.duration;
          console.log('SAI: Video duration', videoDuration);

          if (config?.ignoreVideoLessThan5Minutes && videoDuration != null && videoDuration <= 60 * 5) {
            console.log(`SAI: Ignoring short video (${videoDuration}s)`);
            return;
          }

          if (!videoId) {
            console.error('SAI: No video ID found');
            return;
          }

          await processVideoSubtitles(response, videoId);
        } catch (error) {
          console.error('SAI: Error parsing response:', error);
        }
      });
    }

    // @ts-ignore
    return originalSend.call(this, ...args);
  };

  console.log('SAI: XHR interception active');
})();

// ---- SPA URL monitoring ----

function monitorUrlChanges() {
  setInterval(async () => {
    if (!window.location.pathname.startsWith('/video/')) {
      return;
    }

    const urlVideoId = getVideoIdFromCurrentPage();

    if (!urlVideoId || urlVideoId === currentVideoId) {
      return;
    }

    console.log('SAI: URL changed:', currentVideoId, '->', urlVideoId);

    cleanupAll();
    cleanupRadar();
    currentVideoId = urlVideoId;

    // Refresh cache from content.ts for the new video
    window.postMessage({ type: 'SAI_REQUEST_CACHE' }, '*');

    if (webResponseCache[urlVideoId]) {
      console.log('SAI: Processing from response cache:', urlVideoId);
      await processVideoSubtitles(webResponseCache[urlVideoId], urlVideoId);
    } else {
      console.log('SAI: Response cache miss for:', urlVideoId);
    }
  }, 300);
}

if (window.location.pathname.startsWith('/video/')) {
  currentVideoId = getVideoIdFromCurrentPage();
  console.log('SAI: Initial video ID:', currentVideoId);
}

monitorUrlChanges();
console.log('SAI: URL monitoring active');
