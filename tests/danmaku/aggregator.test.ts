import { describe, it, expect } from 'vitest';
import { aggregateDanmaku } from '../../src/danmaku/aggregator';
import type { Danmaku } from '../../src/danmaku/fetcher';

function makeDanmaku(progressMs: number, content: string): Danmaku {
  return { progress: progressMs, content };
}

describe('aggregateDanmaku', () => {
  it('produces empty output for empty input', () => {
    expect(aggregateDanmaku([])).toEqual([]);
  });

  it('places danmaku into correct 5-second buckets', () => {
    const danmaku: Danmaku[] = [
      makeDanmaku(0, 'a'),       // bucket 0: [0s, 5s)
      makeDanmaku(4999, 'b'),    // bucket 0
      makeDanmaku(5000, 'c'),    // bucket 1: [5s, 10s)
      makeDanmaku(9999, 'd'),    // bucket 1
      makeDanmaku(10000, 'e'),   // bucket 2
    ];
    const result = aggregateDanmaku(danmaku);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ from: 0, to: 5, content: 'a | b' });
    expect(result[1]).toMatchObject({ from: 5, to: 10, content: 'c | d' });
    expect(result[2]).toMatchObject({ from: 10, to: 15, content: 'e' });
  });

  it('drops empty buckets', () => {
    // danmaku at 0s and 20s — bucket 1 (5-10s) and bucket 2 (10-15s) and bucket 3 (15-20s) are empty
    const danmaku: Danmaku[] = [
      makeDanmaku(0, 'start'),
      makeDanmaku(20000, 'end'),
    ];
    const result = aggregateDanmaku(danmaku);
    expect(result).toHaveLength(2);
    expect(result[0].from).toBe(0);
    expect(result[1].from).toBe(20);
  });

  it('output is sorted by from time ascending', () => {
    // Provide danmaku out of time order
    const danmaku: Danmaku[] = [
      makeDanmaku(15000, 'late'),
      makeDanmaku(0, 'early'),
      makeDanmaku(10000, 'mid'),
    ];
    const result = aggregateDanmaku(danmaku);
    const froms = result.map((r) => r.from);
    expect(froms).toEqual([...froms].sort((a, b) => a - b));
  });

  it('truncates bucket at 50 danmaku', () => {
    // 60 danmaku all in the same 5-second window
    const danmaku: Danmaku[] = Array.from({ length: 60 }, (_, i) =>
      makeDanmaku(i * 10, `msg${i}`)  // all within 0-0.6s → bucket 0
    );
    const result = aggregateDanmaku(danmaku);
    // All in bucket 0; content should have exactly 50 items joined by ' | '
    const parts = result[0].content.split(' | ');
    expect(parts).toHaveLength(50);
  });

  it('preserves messages beyond 50 in subsequent buckets', () => {
    // 30 in bucket 0, 30 in bucket 1 — neither truncates
    const bucket0 = Array.from({ length: 30 }, (_, i) => makeDanmaku(i * 100, `b0_${i}`));
    const bucket1 = Array.from({ length: 30 }, (_, i) => makeDanmaku(5000 + i * 100, `b1_${i}`));
    const result = aggregateDanmaku([...bucket0, ...bucket1]);
    expect(result).toHaveLength(2);
    expect(result[0].content.split(' | ')).toHaveLength(30);
    expect(result[1].content.split(' | ')).toHaveLength(30);
  });

  it('respects custom windowSec', () => {
    const danmaku: Danmaku[] = [
      makeDanmaku(0, 'a'),
      makeDanmaku(9999, 'b'),    // both in same 10s window
      makeDanmaku(10000, 'c'),   // new window
    ];
    const result = aggregateDanmaku(danmaku, 10);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ from: 0, to: 10, content: 'a | b' });
    expect(result[1]).toMatchObject({ from: 10, to: 20, content: 'c' });
  });

  it('handles 200 mixed dense and sparse danmaku correctly', () => {
    const dense: Danmaku[] = Array.from({ length: 150 }, (_, i) =>
      makeDanmaku(i * 20, `dense_${i}`)  // all within 0-3s → mostly bucket 0
    );
    const sparse: Danmaku[] = Array.from({ length: 50 }, (_, i) =>
      makeDanmaku(60000 + i * 2000, `sparse_${i}`)  // spread across 60s-160s
    );
    const all = [...dense, ...sparse];
    const result = aggregateDanmaku(all);

    // bucket 0 should be capped at 50
    const bucket0 = result.find((r) => r.from === 0);
    expect(bucket0).toBeDefined();
    expect(bucket0!.content.split(' | ').length).toBeLessThanOrEqual(50);

    // output must be sorted ascending
    const froms = result.map((r) => r.from);
    expect(froms).toEqual([...froms].sort((a, b) => a - b));

    // no bucket should exceed 50 parts
    for (const bucket of result) {
      expect(bucket.content.split(' | ').length).toBeLessThanOrEqual(50);
    }
  });
});
