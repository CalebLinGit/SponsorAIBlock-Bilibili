export interface AdSegment {
  startTime: number;
  endTime: number;
  ad_type: 'Hard_Ad' | 'Integrated_Ad';
  confidence: number;
  reason: string;
}

export interface RadarSignals {
  hasGoodsLink: boolean;
  goodsBrand?: string;
  chapterHits: Array<{ name: string; startTime: number; endTime: number }>;
  tagConflicts: Array<{ tag: string; brand: string; conflict: string }>;
  pinnedCommentText?: string;
}

export interface CacheEntry {
  schema_version: 1;
  segments: AdSegment[];
  ad_type: 'Hard_Ad' | 'Integrated_Ad' | null;
  radar_signals: RadarSignals;
  source: 'radar' | 'ai';
  ts: number; // unix ms timestamp
}

const CACHE_KEY = 'SAI_AD_CACHE';
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export async function getCacheEntry(bvid: string): Promise<CacheEntry | null> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache = result[CACHE_KEY] || {};
  const entry: CacheEntry | undefined = cache[bvid];

  if (!entry) {
    return null;
  }

  if (entry.schema_version !== 1) {
    console.log(`SAI Cache: Entry for ${bvid} has invalid schema_version, discarding`);
    return null;
  }

  if (Date.now() - entry.ts > TTL_MS) {
    console.log(`SAI Cache: Entry for ${bvid} is expired, discarding`);
    return null;
  }

  return entry;
}

export async function setCacheEntry(
  bvid: string,
  entry: Omit<CacheEntry, 'schema_version' | 'ts'>
): Promise<void> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache = result[CACHE_KEY] || {};

  cache[bvid] = {
    ...entry,
    schema_version: 1,
    ts: Date.now(),
  } satisfies CacheEntry;

  await chrome.storage.local.set({ [CACHE_KEY]: cache });
  console.log(`SAI Cache: Saved entry for ${bvid}`);
}

export async function cleanOldEntries(): Promise<void> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache = result[CACHE_KEY] || {};

  const cleaned = Object.entries(cache).reduce((acc, [bvid, entry]: [string, any]) => {
    if (entry.schema_version === 1 && Date.now() - entry.ts <= TTL_MS) {
      acc[bvid] = entry;
    }
    return acc;
  }, {} as Record<string, CacheEntry>);

  const removedCount = Object.keys(cache).length - Object.keys(cleaned).length;
  if (removedCount > 0) {
    console.log(`SAI Cache: Removed ${removedCount} stale entries`);
  }

  await chrome.storage.local.set({ [CACHE_KEY]: cleaned });
}
