import type { Danmaku } from './fetcher';

export interface PseudoSubtitle {
  from: number;  // seconds
  to: number;    // seconds
  content: string;
}

const MAX_PER_BUCKET = 50;

export function aggregateDanmaku(
  danmaku: Danmaku[],
  windowSec: number = 5
): PseudoSubtitle[] {
  const buckets = new Map<number, string[]>();

  for (const d of danmaku) {
    const bucketIdx = Math.floor(d.progress / 1000 / windowSec);
    let bucket = buckets.get(bucketIdx);
    if (!bucket) {
      bucket = [];
      buckets.set(bucketIdx, bucket);
    }
    if (bucket.length < MAX_PER_BUCKET) {
      bucket.push(d.content);
    }
  }

  const result: PseudoSubtitle[] = [];
  for (const [idx, contents] of buckets) {
    if (contents.length === 0) continue;
    result.push({
      from: idx * windowSec,
      to: idx * windowSec + windowSec,
      content: contents.join(' | '),
    });
  }

  return result.sort((a, b) => a.from - b.from);
}
