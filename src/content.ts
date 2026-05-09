import { getCacheEntry, setCacheEntry, cleanOldEntries } from './storage/cache';
import type { AdSegment, RadarSignals } from './storage/cache';

const DEFAULTS = {
  apiKey: '',
  aiModel: 'gemini-2.5-flash',
  ignoreVideoLessThan5Minutes: true,
  enableDanmakuFallback: true,
  danmakuWindowSec: 5,
  radarEnabled: true,
  hardAdAction: 'auto_skip' as const,
  integratedAdAction: 'prompt' as const,
  confidenceThreshold: 0.6,
};

console.log('SAI: Content script loaded');

// Inject Toastify CSS first
const cssLink = document.createElement('link');
cssLink.rel = 'stylesheet';
cssLink.href = chrome.runtime.getURL('lib/toastify.min.css');
(document.head || document.documentElement).appendChild(cssLink);

// Inject inject.js, then Toastify JS
const injectScript = document.createElement('script');
injectScript.src = chrome.runtime.getURL('inject.js');
injectScript.onload = () => {
  console.log('SAI: Inject script loaded');
  injectScript.remove();

  const toastifyScript = document.createElement('script');
  toastifyScript.src = chrome.runtime.getURL('lib/toastify.min.js');
  toastifyScript.onload = function () {
    console.log('SAI: Toastify loaded');
    window.postMessage({ type: 'TOASTIFY_LOADED' }, '*');
  };
  (document.head || document.documentElement).appendChild(toastifyScript);
};
(document.head || document.documentElement).appendChild(injectScript);

(async () => {
  const result = await chrome.storage.local.get([
    'apiKey',
    'aiModel',
    'ignoreVideoLessThan5Minutes',
    'enableDanmakuFallback',
    'danmakuWindowSec',
    'radarEnabled',
    'hardAdAction',
    'integratedAdAction',
    'confidenceThreshold',
  ]);

  const apiKey = result.apiKey || DEFAULTS.apiKey;
  const aiModel = result.aiModel || DEFAULTS.aiModel;
  const ignoreVideoLessThan5Minutes =
    result.ignoreVideoLessThan5Minutes !== undefined
      ? result.ignoreVideoLessThan5Minutes
      : DEFAULTS.ignoreVideoLessThan5Minutes;
  const radarEnabled =
    result.radarEnabled !== undefined ? result.radarEnabled : DEFAULTS.radarEnabled;
  const hardAdAction = result.hardAdAction || DEFAULTS.hardAdAction;
  const integratedAdAction = result.integratedAdAction || DEFAULTS.integratedAdAction;
  const confidenceThreshold =
    result.confidenceThreshold !== undefined
      ? result.confidenceThreshold
      : DEFAULTS.confidenceThreshold;
  const enableDanmakuFallback =
    result.enableDanmakuFallback !== undefined
      ? result.enableDanmakuFallback
      : DEFAULTS.enableDanmakuFallback;
  const danmakuWindowSec =
    result.danmakuWindowSec !== undefined ? result.danmakuWindowSec : DEFAULTS.danmakuWindowSec;

  const resolvedConfig = {
    apiKey,
    aiModel,
    ignoreVideoLessThan5Minutes,
    enableDanmakuFallback,
    danmakuWindowSec,
    radarEnabled,
    hardAdAction,
    integratedAdAction,
    confidenceThreshold,
  };

  console.log('SAI: Config loaded', resolvedConfig);

  const sendConfig = () => {
    window.postMessage(
      {
        type: 'SAI_CONFIG',
        config: resolvedConfig,
      },
      '*'
    );
  };

  const sendCacheToInject = async (bvid?: string) => {
    // If a specific bvid is requested, send just that entry; otherwise send full map
    if (bvid) {
      const entry = await getCacheEntry(bvid);
      window.postMessage(
        {
          type: 'SAI_SEND_CACHE',
          data: entry ? { [bvid]: entry } : {},
        },
        '*'
      );
    } else {
      // Send entire cache snapshot (legacy / full refresh)
      // We don't have a "getAll" helper, so send empty and let inject request by bvid
      window.postMessage({ type: 'SAI_SEND_CACHE', data: {} }, '*');
    }
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'SAI_READY') {
      console.log('SAI: Inject ready, sending config');
      sendConfig();
    }

    if (event.data.type === 'SAI_REQUEST_CACHE') {
      console.log('SAI: Inject requested cache');
      await sendCacheToInject(event.data.bvid);
    }

    if (event.data.type === 'SAI_SAVE_RESULT') {
      console.log('SAI: Saving result to cache', event.data);
      const { bvid, segments, source, radarSignals, inputSource } = event.data.data as {
        bvid: string;
        segments: AdSegment[];
        source: 'radar' | 'ai';
        radarSignals: RadarSignals;
        inputSource?: 'subtitle' | 'danmaku';
      };

      if (!bvid) {
        console.error('SAI: SAI_SAVE_RESULT missing bvid');
        return;
      }

      const adType = segments.length > 0 ? segments[0].ad_type : null;

      await setCacheEntry(bvid, {
        segments,
        ad_type: adType,
        radar_signals: radarSignals || { hasGoodsLink: false, chapterHits: [], tagConflicts: [] },
        source,
        input_source: inputSource ?? 'subtitle',
      });

      await cleanOldEntries();
    }

    if (event.data.type === 'SAI_REQUEST_DANMAKU_XML') {
      const { cid } = event.data;
      try {
        const resp = await fetch(`https://comment.bilibili.com/${cid}.xml`, { credentials: 'include' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const xmlText = await resp.text();
        window.postMessage({ type: 'SAI_DANMAKU_XML_RESULT', xmlText, cid }, '*');
      } catch (err) {
        console.error('SAI: danmaku XML fetch failed:', err);
        window.postMessage({ type: 'SAI_DANMAKU_XML_RESULT', xmlText: null, cid }, '*');
      }
    }

    if (event.data.type === 'SAI_REQUEST_RADAR_SIGNALS') {
      // Stub: respond with empty RadarSignals — actual radar integration in T3/T4
      const bvid = event.data.bvid;
      console.log('SAI: Radar signals requested for', bvid, '— returning empty stub');
      const emptySignals: RadarSignals = {
        hasGoodsLink: false,
        chapterHits: [],
        tagConflicts: [],
      };
      window.postMessage({ type: 'SAI_RADAR_SIGNALS', bvid, signals: emptySignals }, '*');
    }
  });
})();
