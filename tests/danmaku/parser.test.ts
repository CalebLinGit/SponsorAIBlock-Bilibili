import { describe, it, expect } from 'vitest';
import { parseXmlDanmaku } from '../../src/danmaku/parser';

function makeXml(items: Array<{ timeSec: number; type: number; content: string }>): string {
  const elems = items.map(
    ({ timeSec, type, content }) =>
      `<d p="${timeSec},${type},25,16777215,0,0,abc,123">${content}</d>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?><i>${elems.join('')}</i>`;
}

describe('parseXmlDanmaku', () => {
  it('returns empty array for empty XML', () => {
    expect(parseXmlDanmaku('<i></i>')).toEqual([]);
  });

  it('decodes a single danmaku element', () => {
    const xml = makeXml([{ timeSec: 5.0, type: 1, content: '好评' }]);
    const result = parseXmlDanmaku(xml);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ progress: 5000, content: '好评' });
  });

  it('decodes multiple danmaku elements', () => {
    const xml = makeXml([
      { timeSec: 1.0, type: 1, content: 'hello' },
      { timeSec: 3.0, type: 1, content: '哈哈哈' },
      { timeSec: 7.5, type: 4, content: 'LOL' },
    ]);
    const result = parseXmlDanmaku(xml);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ progress: 1000, content: 'hello' });
    expect(result[1]).toEqual({ progress: 3000, content: '哈哈哈' });
    expect(result[2]).toEqual({ progress: 7500, content: 'LOL' });
  });

  it('handles Chinese characters in content', () => {
    const xml = makeXml([{ timeSec: 0.1, type: 1, content: '这是一条弹幕' }]);
    const result = parseXmlDanmaku(xml);
    expect(result[0].content).toBe('这是一条弹幕');
  });

  it('filters out type-7 special danmaku', () => {
    const xml = makeXml([
      { timeSec: 1.0, type: 1, content: '正常弹幕' },
      { timeSec: 2.0, type: 7, content: '{"text":"哈哈","border":false}' },
      { timeSec: 3.0, type: 5, content: '顶部弹幕' },
    ]);
    const result = parseXmlDanmaku(xml);
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.content !== '{"text":"哈哈","border":false}')).toBe(true);
  });

  it('filters out type-8 and type-9 danmaku', () => {
    const xml = makeXml([
      { timeSec: 1.0, type: 8, content: 'js code' },
      { timeSec: 2.0, type: 9, content: 'bas content' },
      { timeSec: 3.0, type: 1, content: '正常弹幕' },
    ]);
    const result = parseXmlDanmaku(xml);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('正常弹幕');
  });

  it('filters out danmaku with content longer than 100 chars', () => {
    const longContent = 'A'.repeat(101);
    const xml = makeXml([
      { timeSec: 1.0, type: 1, content: '正常弹幕' },
      { timeSec: 2.0, type: 1, content: longContent },
    ]);
    const result = parseXmlDanmaku(xml);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('正常弹幕');
  });

  it('output is sorted by progress ascending', () => {
    const xml = makeXml([
      { timeSec: 30.0, type: 1, content: 'late' },
      { timeSec: 1.0, type: 1, content: 'early' },
      { timeSec: 15.5, type: 1, content: 'mid' },
    ]);
    const result = parseXmlDanmaku(xml);
    expect(result[0].content).toBe('early');
    expect(result[1].content).toBe('mid');
    expect(result[2].content).toBe('late');
    for (let i = 1; i < result.length; i++) {
      expect(result[i].progress).toBeGreaterThanOrEqual(result[i - 1].progress);
    }
  });

  it('converts fractional seconds to ms correctly', () => {
    const xml = makeXml([{ timeSec: 12.345, type: 1, content: 'test' }]);
    const result = parseXmlDanmaku(xml);
    expect(result[0].progress).toBe(12345);
  });
});
