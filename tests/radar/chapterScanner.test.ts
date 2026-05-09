import { scanChapters, calculateChapterCoverage } from '../../src/radar/chapterScanner';

describe('scanChapters', () => {
  it('returns [] when viewPoints is empty array', () => {
    expect(scanChapters([])).toEqual([]);
  });

  it('returns a hit for keyword 好东西', () => {
    const vp = [{ content: '好东西', from: 100, to: 200 }];
    expect(scanChapters(vp)).toEqual([{ name: '好东西', startTime: 100, endTime: 200 }]);
  });

  it('returns a hit for keyword 福利', () => {
    const vp = [{ content: '福利时间', from: 30, to: 90 }];
    expect(scanChapters(vp)).toEqual([{ name: '福利时间', startTime: 30, endTime: 90 }]);
  });

  it('returns a hit for keyword 老朋友', () => {
    const vp = [{ content: '老朋友推荐', from: 50, to: 120 }];
    expect(scanChapters(vp)).toEqual([{ name: '老朋友推荐', startTime: 50, endTime: 120 }]);
  });

  it('returns a hit for keyword 恰饭', () => {
    const vp = [{ content: '恰饭环节', from: 200, to: 300 }];
    expect(scanChapters(vp)).toEqual([{ name: '恰饭环节', startTime: 200, endTime: 300 }]);
  });

  it('skips entries without a matching keyword', () => {
    expect(scanChapters([{ content: '正片内容', from: 0, to: 60 }])).toEqual([]);
  });

  it('skips malformed entries missing from/to', () => {
    const vp = [
      { content: '好东西' },
      { content: '好东西', from: 10 },
      { content: '好东西', to: 50 },
    ];
    expect(scanChapters(vp)).toEqual([]);
  });

  it('skips entries where to <= from', () => {
    expect(scanChapters([{ content: '好东西', from: 100, to: 100 }])).toEqual([]);
  });

  it('returns multiple hits from mixed view_points', () => {
    const vp = [
      { content: '开场', from: 0, to: 30 },
      { content: '好东西', from: 30, to: 120 },
      { content: '正片', from: 120, to: 300 },
      { content: '恰饭', from: 300, to: 360 },
    ];
    const hits = scanChapters(vp);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({ name: '好东西', startTime: 30, endTime: 120 });
    expect(hits[1]).toEqual({ name: '恰饭', startTime: 300, endTime: 360 });
  });

  it('trims whitespace from chapter names', () => {
    expect(scanChapters([{ content: '  好东西  ', from: 10, to: 50 }])[0].name).toBe('好东西');
  });
});

describe('calculateChapterCoverage', () => {
  it('returns 0 when hits is empty', () => {
    expect(calculateChapterCoverage([], 600)).toBe(0);
  });

  it('returns 0 when videoDuration is 0', () => {
    expect(calculateChapterCoverage([{ name: '好东西', startTime: 0, endTime: 30 }], 0)).toBe(0);
  });

  it('calculates simple non-overlapping coverage', () => {
    const hits = [
      { name: '好东西', startTime: 0, endTime: 100 },
      { name: '恰饭', startTime: 200, endTime: 300 },
    ];
    expect(calculateChapterCoverage(hits, 600)).toBeCloseTo(200 / 600);
  });

  it('merges overlapping intervals to avoid double-counting', () => {
    const hits = [
      { name: '好东西', startTime: 0, endTime: 200 },
      { name: '福利', startTime: 100, endTime: 300 },
    ];
    expect(calculateChapterCoverage(hits, 600)).toBeCloseTo(300 / 600);
  });

  it('clamps intervals to video duration', () => {
    const hits = [{ name: '好东西', startTime: 500, endTime: 700 }];
    expect(calculateChapterCoverage(hits, 600)).toBeCloseTo(100 / 600);
  });

  it('coverage > 0.6 when most of the video is flagged', () => {
    const hits = [
      { name: '好东西', startTime: 0, endTime: 200 },
      { name: '福利', startTime: 200, endTime: 400 },
    ];
    const coverage = calculateChapterCoverage(hits, 600);
    expect(coverage).toBeCloseTo(400 / 600);
    expect(coverage).toBeGreaterThan(0.6);
  });
});
