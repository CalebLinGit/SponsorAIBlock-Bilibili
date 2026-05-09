import { parseXmlDanmaku } from './parser';
import { aggregateDanmaku } from './aggregator';
import { convertSubtitleObjToStr } from '../util';

export function getDanmakuAsPseudoSubtitle(xmlText: string, windowSec: number = 5): string {
  const danmaku = parseXmlDanmaku(xmlText);

  console.log(`[SAI:DANMAKU] Parsed ${danmaku.length} items from XML`);
  if (danmaku.length > 0) {
    console.log('[SAI:DANMAKU] First 5:', danmaku.slice(0, 5).map(
      (d) => `[${(d.progress / 1000).toFixed(1)}s] ${d.content}`
    ).join(' | '));
  } else {
    console.warn('[SAI:DANMAKU] No danmaku parsed — XML may be empty or all items filtered out');
  }

  const buckets = aggregateDanmaku(danmaku, windowSec);
  console.log(`[SAI:DANMAKU] ${buckets.length} buckets (windowSec=${windowSec})`);

  return convertSubtitleObjToStr(buckets);
}
