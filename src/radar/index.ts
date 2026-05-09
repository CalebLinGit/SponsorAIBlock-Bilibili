import { scanChapters, calculateChapterCoverage, ChapterHit } from './chapterScanner';
import { scanShadowDom, disconnectShadowObserver, GoodsLinkResult } from './shadowDomScanner';
import { inspectTags, TagConflict } from './tagInspector';
import { AdSegment } from '../storage/cache';

export interface RadarSignals {
  hasGoodsLink: boolean;
  goodsBrand?: string;
  chapterHits: ChapterHit[];
  tagConflicts: TagConflict[];
  pinnedCommentText?: string;
}

export interface RadarDecision {
  signals: RadarSignals;
  // If chapter short-circuit fired: pre-built segments (no AI needed)
  shortCircuitSegments?: AdSegment[];
  // If not short-circuit: signals to pass to AI as context
}

const CHAPTER_COVERAGE_THRESHOLD = 0.6;

function buildSegmentFromChapter(hit: ChapterHit): AdSegment {
  return {
    startTime: hit.startTime,
    endTime: hit.endTime,
    ad_type: 'Hard_Ad',
    confidence: 1.0,
    reason: `章节关键词命中: ${hit.name}`,
  };
}

export async function runRadar(videoDuration: number): Promise<RadarDecision> {
  // Step 1: Run synchronous scans immediately
  const chapterHits = scanChapters();
  const tagConflicts = inspectTags();

  // Step 2: Determine chapter short-circuit decision before awaiting shadow DOM
  let shortCircuitSegments: AdSegment[] | undefined;
  let chapterShortCircuit = false;

  if (chapterHits.length > 0) {
    const coverage = calculateChapterCoverage(chapterHits, videoDuration);
    if (coverage <= CHAPTER_COVERAGE_THRESHOLD) {
      // Hits found and coverage is reasonable — short-circuit with pre-built segments
      chapterShortCircuit = true;
      shortCircuitSegments = chapterHits.map(buildSegmentFromChapter);
    }
    // If coverage > 60%: too much of the video is flagged; likely a false positive or
    // the whole video is an ad — pass along as signals only, let AI decide
  }

  // Step 3: Start shadow DOM scan (async, up to 30s)
  // We still run it even on short-circuit to collect brand signals for the cache entry
  const shadowResult: GoodsLinkResult = await scanShadowDom();

  // Step 4: Build signals
  const signals: RadarSignals = {
    hasGoodsLink: shadowResult.found,
    goodsBrand: shadowResult.brand,
    chapterHits,
    tagConflicts,
    pinnedCommentText: shadowResult.pinnedCommentText,
  };

  // Step 5: If shadow DOM found a goods link and we didn't already short-circuit,
  // and there are also chapter hits, upgrade to short-circuit
  if (!chapterShortCircuit && shadowResult.found && chapterHits.length > 0) {
    shortCircuitSegments = chapterHits.map(buildSegmentFromChapter);
  }

  return {
    signals,
    shortCircuitSegments,
  };
}

export function cleanupRadar(): void {
  disconnectShadowObserver();
}

export function emptyRadarSignals(): RadarSignals {
  return {
    hasGoodsLink: false,
    chapterHits: [],
    tagConflicts: [],
  };
}

export type { ChapterHit, GoodsLinkResult, TagConflict };
