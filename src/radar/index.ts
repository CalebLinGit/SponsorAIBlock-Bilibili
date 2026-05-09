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

export async function runRadar(videoDuration: number, viewPoints: any[] = []): Promise<RadarDecision> {
  const tagConflicts = inspectTags();

  // Step 1: Shadow DOM scan (async, up to 30s) — by the time it resolves the player DOM is settled
  const shadowResult: GoodsLinkResult = await scanShadowDom();

  // Step 2: Chapter scan — try API view_point first, fall back to DOM (now definitely rendered)
  const chapterHits = scanChapters(viewPoints);

  // Step 3: Short-circuit decision
  let shortCircuitSegments: AdSegment[] | undefined;
  let chapterShortCircuit = false;

  if (chapterHits.length > 0) {
    const coverage = calculateChapterCoverage(chapterHits, videoDuration);
    if (coverage <= CHAPTER_COVERAGE_THRESHOLD) {
      chapterShortCircuit = true;
      shortCircuitSegments = chapterHits.map(buildSegmentFromChapter);
    }
  }

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
