export interface ChapterHit {
  name: string;
  startTime: number;
  endTime: number;
}

const AD_KEYWORDS = ['好东西', '福利', '老朋友', '恰饭'];

function parseTime(value: string | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

/**
 * Parses a timestamp string like "0:30" or "1:23:45" into seconds.
 */
function parseTimestampText(text: string): number | null {
  const trimmed = text.trim();
  const parts = trimmed.split(':').map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function scanChapters(): ChapterHit[] {
  const items = document.querySelectorAll<HTMLElement>('.video-sections-item');
  if (items.length === 0) return [];

  const hits: ChapterHit[] = [];

  items.forEach((item, index) => {
    // Try to get chapter name from dedicated sub-element first
    const nameEl = item.querySelector<HTMLElement>('.video-sections-item-name');
    const name = (nameEl?.textContent ?? item.textContent ?? '').trim();

    if (!name) return;

    const hasKeyword = AD_KEYWORDS.some((kw) => name.includes(kw));
    if (!hasKeyword) return;

    // Try dataset attributes first
    let startTime = parseTime(item.dataset.startTime);
    let endTime = parseTime(item.dataset.endTime);

    // Fallback: look for timestamp text elements
    if (startTime === null) {
      const tsEl = item.querySelector<HTMLElement>('.video-sections-item-timestamp');
      if (tsEl) {
        startTime = parseTimestampText(tsEl.textContent ?? '');
      }
    }

    // If we still don't have a start time, skip this item
    if (startTime === null) return;

    // If no end time, try the next sibling item's start time; otherwise use startTime + 30s as a rough estimate
    if (endTime === null) {
      const nextItem = items[index + 1] as HTMLElement | undefined;
      if (nextItem) {
        const nextStart = parseTime(nextItem.dataset.startTime);
        if (nextStart !== null) {
          endTime = nextStart;
        }
      }
    }

    if (endTime === null) {
      // Last chapter — endTime unknown, use a sentinel value
      endTime = startTime + 30;
    }

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
