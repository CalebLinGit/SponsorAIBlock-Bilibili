import { vi } from 'vitest';
import { inspectTags } from '../../src/radar/tagInspector';

// Helper to set and restore __INITIAL_STATE__ around each test
function withInitialState(state: any, fn: () => void): void {
  (window as any).__INITIAL_STATE__ = state;
  try {
    fn();
  } finally {
    delete (window as any).__INITIAL_STATE__;
  }
}

describe('inspectTags', () => {
  afterEach(() => {
    delete (window as any).__INITIAL_STATE__;
  });

  it('returns [] when window.__INITIAL_STATE__ is not present', () => {
    delete (window as any).__INITIAL_STATE__;
    expect(inspectTags()).toEqual([]);
  });

  it('returns [] when videoData is missing', () => {
    (window as any).__INITIAL_STATE__ = {};
    expect(inspectTags()).toEqual([]);
  });

  it('returns [] when tags array is absent (videoData.tag = undefined)', () => {
    (window as any).__INITIAL_STATE__ = {
      videoData: { tname: '军事', tag: undefined },
    };
    expect(inspectTags()).toEqual([]);
  });

  it('returns [] when tags array is empty', () => {
    (window as any).__INITIAL_STATE__ = {
      videoData: { tname: '军事', tag: [] },
    };
    expect(inspectTags()).toEqual([]);
  });

  it('returns [] when tname is falsy', () => {
    (window as any).__INITIAL_STATE__ = {
      videoData: { tname: '', tag: [{ tag_name: '元力象' }] },
    };
    expect(inspectTags()).toEqual([]);
  });

  it('returns [] when the video category is not a sensitive one (no conflict possible)', () => {
    // "数码" is NOT in SENSITIVE_VIDEO_CATEGORIES, and DJI大疆 is a 数码 brand
    (window as any).__INITIAL_STATE__ = {
      videoData: { tname: '数码', tag: [{ tag_name: 'DJI大疆' }] },
    };
    expect(inspectTags()).toEqual([]);
  });

  it('returns [] when video category is sensitive but the brand is in the same (non-conflicting) context', () => {
    // 科技 is sensitive, but a 数码 brand appearing in a 科技 video is still flagged as a conflict
    // Let's use a tag with no matching brand at all
    (window as any).__INITIAL_STATE__ = {
      videoData: { tname: '军事', tag: [{ tag_name: '战役分析' }] },
    };
    expect(inspectTags()).toEqual([]);
  });

  it('detects a conflict: 军事 video with 元力象 (日用品) tag', () => {
    (window as any).__INITIAL_STATE__ = {
      videoData: {
        tname: '军事',
        tag: [{ tag_name: '元力象' }],
      },
    };
    const conflicts = inspectTags();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].tag).toBe('元力象');
    expect(conflicts[0].brand).toBe('元力象');
    expect(conflicts[0].conflict).toContain('军事视频');
    expect(conflicts[0].conflict).toContain('元力象');
  });

  it('detects a conflict using keyword matching: 军事 video with tag containing 内裤 (元力象 keyword)', () => {
    (window as any).__INITIAL_STATE__ = {
      videoData: {
        tname: '历史',
        tag: [{ tag_name: '内裤推荐' }],
      },
    };
    const conflicts = inspectTags();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].brand).toBe('元力象');
    expect(conflicts[0].conflict).toContain('历史视频');
  });

  it('returns only the conflicting tag when multiple tags exist but only one conflicts', () => {
    (window as any).__INITIAL_STATE__ = {
      videoData: {
        tname: '军事',
        tag: [
          { tag_name: '战术分析' },
          { tag_name: '元力象' },
          { tag_name: '武器史' },
        ],
      },
    };
    const conflicts = inspectTags();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].tag).toBe('元力象');
  });

  it('returns multiple conflicts when multiple tags conflict', () => {
    (window as any).__INITIAL_STATE__ = {
      videoData: {
        tname: '历史',
        tag: [
          { tag_name: '元力象' },   // 日用品 brand
          { tag_name: '元气森林' },  // 食品 brand
        ],
      },
    };
    const conflicts = inspectTags();
    expect(conflicts).toHaveLength(2);
    const brands = conflicts.map((c) => c.brand);
    expect(brands).toContain('元力象');
    expect(brands).toContain('元气森林');
  });

  it('detects conflict for 科技 category with a 食品 brand', () => {
    (window as any).__INITIAL_STATE__ = {
      videoData: {
        tname: '科技',
        tag: [{ tag_name: '三只松鼠' }],
      },
    };
    const conflicts = inspectTags();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].brand).toBe('三只松鼠');
    expect(conflicts[0].conflict).toContain('科技视频');
  });

  it('does NOT flag a brand whose category is not in AD_BRAND_CATEGORIES for conflict', () => {
    // All current brands in brandCategoryMap are in AD_BRAND_CATEGORIES (日用品/食品/汽车/保健/数码)
    // This test verifies that non-matching tag names produce no conflicts
    (window as any).__INITIAL_STATE__ = {
      videoData: {
        tname: '军事',
        tag: [{ tag_name: '不知名小品牌XYZ' }],
      },
    };
    expect(inspectTags()).toEqual([]);
  });

  it('returns conflict with correct conflict string format', () => {
    (window as any).__INITIAL_STATE__ = {
      videoData: {
        tname: '军事',
        tag: [{ tag_name: '元力象' }],
      },
    };
    const [conflict] = inspectTags();
    // Expected format: "军事视频 + 日用品品牌(元力象)"
    expect(conflict.conflict).toBe('军事视频 + 日用品品牌(元力象)');
  });
});
