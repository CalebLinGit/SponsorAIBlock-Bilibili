export interface Danmaku {
  progress: number; // ms from start
  content: string;
}

const NORMAL_TYPES = new Set([1, 4, 5]);
const MAX_CONTENT_LEN = 100;

export function parseXmlDanmaku(xmlText: string): Danmaku[] {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const result: Danmaku[] = [];

  for (const d of doc.querySelectorAll('d')) {
    const p = d.getAttribute('p');
    if (!p) continue;
    const parts = p.split(',');
    const timeSec = parseFloat(parts[0]);
    const type = parseInt(parts[1]) || 1;
    const text = d.textContent || '';
    if (!NORMAL_TYPES.has(type)) continue;
    if (!text || text.length > MAX_CONTENT_LEN) continue;
    result.push({ progress: Math.round(timeSec * 1000), content: text });
  }

  return result.sort((a, b) => a.progress - b.progress);
}
