import { vi } from 'vitest';
import { scanChapters, calculateChapterCoverage } from '../../src/radar/chapterScanner';

describe('scanChapters', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns [] when DOM has no chapter items', () => {
    document.body.innerHTML = '<div id="app"></div>';
    expect(scanChapters()).toEqual([]);
  });

  it('returns a hit for chapter with keyword 好东西', () => {
    document.body.innerHTML = `
      <div class="video-sections-item" data-start-time="100" data-end-time="200">
        <span class="video-sections-item-name">好东西</span>
      </div>
    `;
    const hits = scanChapters();
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ name: '好东西', startTime: 100, endTime: 200 });
  });

  it('returns a hit for chapter with keyword 福利', () => {
    document.body.innerHTML = `
      <div class="video-sections-item" data-start-time="30" data-end-time="90">
        <span class="video-sections-item-name">福利时间</span>
      </div>
    `;
    const hits = scanChapters();
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('福利时间');
    expect(hits[0].startTime).toBe(30);
    expect(hits[0].endTime).toBe(90);
  });

  it('returns a hit for chapter with keyword 老朋友', () => {
    document.body.innerHTML = `
      <div class="video-sections-item" data-start-time="50" data-end-time="120">
        <span class="video-sections-item-name">老朋友推荐</span>
      </div>
    `;
    const hits = scanChapters();
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('老朋友推荐');
  });

  it('returns a hit for chapter with keyword 恰饭', () => {
    document.body.innerHTML = `
      <div class="video-sections-item" data-start-time="200" data-end-time="300">
        <span class="video-sections-item-name">恰饭环节</span>
      </div>
    `;
    const hits = scanChapters();
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('恰饭环节');
  });

  it('returns [] for chapter with non-ad keyword', () => {
    document.body.innerHTML = `
      <div class="video-sections-item" data-start-time="0" data-end-time="60">
        <span class="video-sections-item-name">精彩片段</span>
      </div>
    `;
    expect(scanChapters()).toEqual([]);
  });

  it('returns only the matching chapter when multiple chapters exist and only one matches', () => {
    document.body.innerHTML = `
      <div class="video-sections-item" data-start-time="0" data-end-time="100">
        <span class="video-sections-item-name">开场介绍</span>
      </div>
      <div class="video-sections-item" data-start-time="100" data-end-time="200">
        <span class="video-sections-item-name">好东西分享</span>
      </div>
      <div class="video-sections-item" data-start-time="200" data-end-time="350">
        <span class="video-sections-item-name">正片内容</span>
      </div>
    `;
    const hits = scanChapters();
    expect(hits).toHaveLength(1);
    expect(hits[0].name).toBe('好东西分享');
    expect(hits[0].startTime).toBe(100);
    expect(hits[0].endTime).toBe(200);
  });

  it('uses next sibling start time as endTime when endTime attribute is absent', () => {
    document.body.innerHTML = `
      <div class="video-sections-item" data-start-time="100">
        <span class="video-sections-item-name">好东西</span>
      </div>
      <div class="video-sections-item" data-start-time="250">
        <span class="video-sections-item-name">正片</span>
      </div>
    `;
    const hits = scanChapters();
    expect(hits).toHaveLength(1);
    expect(hits[0].endTime).toBe(250);
  });

  it('falls back to startTime + 30 as endTime when last chapter has no endTime', () => {
    document.body.innerHTML = `
      <div class="video-sections-item" data-start-time="500">
        <span class="video-sections-item-name">好东西</span>
      </div>
    `;
    const hits = scanChapters();
    expect(hits).toHaveLength(1);
    expect(hits[0].endTime).toBe(530);
  });
});

describe('calculateChapterCoverage', () => {
  it('returns 0 for empty hits array', () => {
    expect(calculateChapterCoverage([], 600)).toBe(0);
  });

  it('returns 0 for zero video duration', () => {
    const hits = [{ name: '好东西', startTime: 0, endTime: 60 }];
    expect(calculateChapterCoverage(hits, 0)).toBe(0);
  });

  it('calculates coverage for two non-overlapping 60s chapters in a 600s video', () => {
    const hits = [
      { name: '好东西', startTime: 100, endTime: 160 },
      { name: '福利', startTime: 300, endTime: 360 },
    ];
    const coverage = calculateChapterCoverage(hits, 600);
    // 60s + 60s = 120s out of 600s = 0.2
    expect(coverage).toBeCloseTo(0.2);
  });

  it('returns coverage > 0.6 when chapters cover more than 60% of the video', () => {
    // Three chapters covering ~400s of a 600s video
    const hits = [
      { name: '好东西', startTime: 0, endTime: 150 },
      { name: '福利', startTime: 150, endTime: 300 },
      { name: '老朋友', startTime: 300, endTime: 400 },
    ];
    const coverage = calculateChapterCoverage(hits, 600);
    // 400s / 600s ≈ 0.667
    expect(coverage).toBeGreaterThan(0.6);
  });

  it('merges overlapping intervals to avoid double-counting', () => {
    const hits = [
      { name: '好东西', startTime: 100, endTime: 250 },
      { name: '福利', startTime: 200, endTime: 350 },
    ];
    const coverage = calculateChapterCoverage(hits, 600);
    // Merged: 100–350 = 250s / 600s ≈ 0.4167
    expect(coverage).toBeCloseTo(250 / 600);
  });

  it('clamps intervals to video duration boundaries', () => {
    const hits = [{ name: '好东西', startTime: 550, endTime: 700 }];
    const coverage = calculateChapterCoverage(hits, 600);
    // Clamped end = 600, so 50s / 600s ≈ 0.0833
    expect(coverage).toBeCloseTo(50 / 600);
  });
});
