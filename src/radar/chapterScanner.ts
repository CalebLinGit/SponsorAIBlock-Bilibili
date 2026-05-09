export interface ChapterHit {
  name: string;
  startTime: number;
  endTime: number;
}

const AD_KEYWORDS = ['好东西', '福利', '老朋友', '恰饭'];

export function scanChapters(viewPoints: any[]): ChapterHit[] {
  // Primary: API view_point array from wbi/v2 response
  if (Array.isArray(viewPoints) && viewPoints.length > 0) {
    const hits = viewPoints
      .filter(
        (p: any) =>
          typeof p?.content === 'string' &&
          AD_KEYWORDS.some((kw) => p.content.includes(kw)) &&
          Number.isFinite(p.from) &&
          Number.isFinite(p.to) &&
          p.to > p.from
      )
      .map((p: any) => ({ name: (p.content as string).trim(), startTime: p.from as number, endTime: p.to as number }));
    if (hits.length > 0) return hits;
  }

  // Fallback: DOM scan with the actual Bilibili player chapter selector
  const items = document.querySelectorAll<HTMLElement>('.bpx-player-ctrl-viewpoint-menu-item');
  if (items.length === 0) return [];

  const hits: ChapterHit[] = [];
  items.forEach((item, index) => {
    const nameEl = item.querySelector<HTMLElement>('.bpx-player-ctrl-viewpoint-menu-item-content');
    const name = (nameEl?.textContent ?? '').trim();
    if (!name || !AD_KEYWORDS.some((kw) => name.includes(kw))) return;

    const startTime = parseFloat(item.dataset.time ?? '');
    if (!Number.isFinite(startTime)) return;

    // End time: next sibling's start time, or start + 30s sentinel for last item
    const nextItem = items[index + 1] as HTMLElement | undefined;
    const endTime = nextItem
      ? parseFloat(nextItem.dataset.time ?? '')
      : startTime + 30;
    if (!Number.isFinite(endTime) || endTime <= startTime) return;

    hits.push({ name, startTime, endTime });
  });
  return hits;
}

export function calculateChapterCoverage(hits: ChapterHit[], videoDuration: number): number {
  if (videoDuration <= 0 || hits.length === 0) return 0;

  // Merge overlapping intervals to avoid double-counting
  const sorted = [...hits].sort((a, b) => a.startTime - b.startTime);
  const merged: Array<{ start: number; end: number }> = [];

  for (const hit of sorted) {
    const start = Math.max(0, hit.startTime);
    const end = Math.min(videoDuration, hit.endTime);
    if (start >= end) continue;

    if (merged.length === 0 || merged[merged.length - 1].end < start) {
      merged.push({ start, end });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, end);
    }
  }

  const coveredSeconds = merged.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
  return coveredSeconds / videoDuration;
}
