import { vi } from 'vitest';
import { buildPrompt, VideoMetadata } from '../../src/prompt/builder';
import type { RadarSignals } from '../../src/storage/cache';

function emptySignals(): RadarSignals {
  return {
    hasGoodsLink: false,
    chapterHits: [],
    tagConflicts: [],
  };
}

const EMPTY_METADATA: VideoMetadata = {};
const SAMPLE_SUBTITLE = '[00:00-00:10]:今天我们来介绍一款产品。';

describe('buildPrompt', () => {
  it('always contains few-shot example labels Hard_Ad and Integrated_Ad', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).toContain('Hard_Ad');
    expect(prompt).toContain('Integrated_Ad');
  });

  it('always contains the output format instruction with "segments" key', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).toContain('segments');
  });

  it('always contains the role instruction block', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).toContain('B站视频广告识别助手');
  });

  it('always includes the subtitle content in the output', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).toContain(SAMPLE_SUBTITLE);
  });

  it('shows "无雷达信号" placeholder when radar signals are empty', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).toContain('无雷达信号');
  });

  it('includes goods link signal with brand when hasGoodsLink is true', () => {
    const signals: RadarSignals = {
      ...emptySignals(),
      hasGoodsLink: true,
      goodsBrand: '妙界',
    };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, signals, EMPTY_METADATA);
    expect(prompt).toContain('置顶评论含商品链接');
    expect(prompt).toContain('妙界');
  });

  it('does NOT include goods link line when hasGoodsLink is false', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).not.toContain('置顶评论含商品链接');
  });

  it('does NOT include goods link line when hasGoodsLink is true but goodsBrand is undefined', () => {
    const signals: RadarSignals = {
      ...emptySignals(),
      hasGoodsLink: true,
      goodsBrand: undefined,
    };
    // Per builder.ts: line only added when BOTH hasGoodsLink AND goodsBrand are truthy
    const prompt = buildPrompt(SAMPLE_SUBTITLE, signals, EMPTY_METADATA);
    expect(prompt).not.toContain('置顶评论含商品链接');
  });

  it('includes chapter hit names when chapterHits are provided', () => {
    const signals: RadarSignals = {
      ...emptySignals(),
      chapterHits: [{ name: '好东西', startTime: 100, endTime: 200 }],
    };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, signals, EMPTY_METADATA);
    expect(prompt).toContain('章节关键词命中');
    expect(prompt).toContain('好东西');
  });

  it('includes all chapter hit names joined by 、', () => {
    const signals: RadarSignals = {
      ...emptySignals(),
      chapterHits: [
        { name: '好东西', startTime: 100, endTime: 200 },
        { name: '福利时间', startTime: 300, endTime: 400 },
      ],
    };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, signals, EMPTY_METADATA);
    expect(prompt).toContain('好东西');
    expect(prompt).toContain('福利时间');
    expect(prompt).toContain('、');
  });

  it('includes tag conflict strings when tagConflicts are provided', () => {
    const signals: RadarSignals = {
      ...emptySignals(),
      tagConflicts: [
        { tag: '元力象', brand: '元力象', conflict: '军事视频+内衣品牌' },
      ],
    };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, signals, EMPTY_METADATA);
    expect(prompt).toContain('Tag类目冲突');
    expect(prompt).toContain('军事视频+内衣品牌');
  });

  it('includes pinned comment text when pinnedCommentText is provided', () => {
    const signals: RadarSignals = {
      ...emptySignals(),
      hasGoodsLink: true,
      goodsBrand: '妙界',
      pinnedCommentText: '这是一条置顶评论内容',
    };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, signals, EMPTY_METADATA);
    expect(prompt).toContain('置顶评论摘要');
    expect(prompt).toContain('这是一条置顶评论内容');
  });

  it('truncates pinned comment text to 100 chars', () => {
    const longText = 'A'.repeat(150);
    const signals: RadarSignals = {
      ...emptySignals(),
      hasGoodsLink: true,
      goodsBrand: 'X',
      pinnedCommentText: longText,
    };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, signals, EMPTY_METADATA);
    // The truncated text (100 chars) should appear, but the full 150-char string should not
    expect(prompt).toContain('A'.repeat(100));
    expect(prompt).not.toContain('A'.repeat(101));
  });

  it('includes video title in the prompt when metadata.title is set', () => {
    const metadata: VideoMetadata = { title: '揭秘历史真相' };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), metadata);
    expect(prompt).toContain('标题：揭秘历史真相');
  });

  it('includes tname in the prompt when metadata.tname is set', () => {
    const metadata: VideoMetadata = { tname: '军事' };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), metadata);
    expect(prompt).toContain('分类：军事');
  });

  it('includes description in the prompt when metadata.description is set', () => {
    const metadata: VideoMetadata = { description: '本期视频介绍一段历史。' };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), metadata);
    expect(prompt).toContain('描述：本期视频介绍一段历史。');
  });

  it('truncates description to 200 chars', () => {
    const longDesc = 'B'.repeat(250);
    const metadata: VideoMetadata = { description: longDesc };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), metadata);
    expect(prompt).toContain('B'.repeat(200));
    expect(prompt).not.toContain('B'.repeat(201));
  });

  it('omits the 【视频信息】 block when metadata is all empty', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).not.toContain('【视频信息】');
  });

  it('includes all three metadata fields when all are provided', () => {
    const metadata: VideoMetadata = {
      title: '我的标题',
      tname: '历史',
      description: '一段精彩的描述',
    };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), metadata);
    expect(prompt).toContain('我的标题');
    expect(prompt).toContain('历史');
    expect(prompt).toContain('一段精彩的描述');
  });

  it('snapshot: minimal input (no radar, no metadata)', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).toMatchSnapshot();
  });

  it('snapshot: full input with all signals and metadata', () => {
    const signals: RadarSignals = {
      hasGoodsLink: true,
      goodsBrand: '妙界',
      chapterHits: [{ name: '好东西', startTime: 100, endTime: 200 }],
      tagConflicts: [{ tag: '元力象', brand: '元力象', conflict: '军事视频+内衣品牌' }],
      pinnedCommentText: '置顶内容摘要',
    };
    const metadata: VideoMetadata = {
      title: '视频标题',
      tname: '军事',
      description: '视频简介',
    };
    const prompt = buildPrompt(SAMPLE_SUBTITLE, signals, metadata);
    expect(prompt).toMatchSnapshot();
  });

  it('contains all four few-shot example headers', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).toContain('【示例1 - Hard_Ad】');
    expect(prompt).toContain('【示例2 - Hard_Ad】');
    expect(prompt).toContain('【示例3 - Integrated_Ad】');
    expect(prompt).toContain('【示例4 - Integrated_Ad】');
  });

  it('contains output format block', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).toContain('【输出格式】');
    expect(prompt).toContain('startTime');
    expect(prompt).toContain('endTime');
    expect(prompt).toContain('confidence');
  });

  it('contains the subtitle section delimiters', () => {
    const prompt = buildPrompt(SAMPLE_SUBTITLE, emptySignals(), EMPTY_METADATA);
    expect(prompt).toContain('【字幕内容】');
    expect(prompt).toContain('------');
  });
});
