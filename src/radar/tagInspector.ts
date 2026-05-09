import brandCategoryMap from './brandCategoryMap.json';

export interface TagConflict {
  tag: string;
  brand: string;
  conflict: string;
}

declare const window: Window & {
  __INITIAL_STATE__?: {
    videoData?: {
      tag?: Array<{ tag_name: string }>;
      tname?: string;
    };
  };
};

// Map of video tname categories considered non-commercial (i.e. brand presence is out-of-place)
// Key: video tname substring, Value: human-readable label
const SENSITIVE_VIDEO_CATEGORIES: Array<{ pattern: string; label: string }> = [
  { pattern: '军事', label: '军事视频' },
  { pattern: '历史', label: '历史视频' },
  { pattern: '政治', label: '政治视频' },
  { pattern: '科技', label: '科技视频' },
  { pattern: '知识', label: '知识视频' },
  { pattern: '教育', label: '教育视频' },
  { pattern: '纪录片', label: '纪录片' },
  { pattern: '人文', label: '人文视频' },
  { pattern: '社会', label: '社会议题视频' },
  { pattern: '新闻', label: '新闻视频' },
];

// Ad-type categories that would be unexpected in non-commercial video contexts
const AD_BRAND_CATEGORIES = new Set(['日用品', '食品', '汽车', '保健', '数码']);

interface BrandEntry {
  name: string;
  category: string;
  keywords: string[];
}

/**
 * Finds a brand entry whose name or keywords appear in the given tag name.
 */
function matchBrand(tagName: string): BrandEntry | null {
  for (const brand of brandCategoryMap.brands as BrandEntry[]) {
    if (tagName.includes(brand.name)) return brand;
    for (const kw of brand.keywords) {
      if (tagName.includes(kw)) return brand;
    }
  }
  return null;
}

export function inspectTags(): TagConflict[] {
  const state = (window as any).__INITIAL_STATE__;
  if (!state?.videoData) return [];

  const tags: Array<{ tag_name: string }> = state.videoData.tag ?? [];
  const tname: string = state.videoData.tname ?? '';

  if (tags.length === 0 || !tname) return [];

  // Determine if the video category is a sensitive (non-commercial) one
  const videoCategory = SENSITIVE_VIDEO_CATEGORIES.find((c) =>
    tname.includes(c.pattern)
  );

  if (!videoCategory) {
    // Not a sensitive category — no conflict possible
    return [];
  }

  const conflicts: TagConflict[] = [];

  for (const tag of tags) {
    const tagName = tag.tag_name ?? '';
    if (!tagName) continue;

    const brand = matchBrand(tagName);
    if (!brand) continue;

    // A conflict exists when the brand is in an ad-heavy category but the video is non-commercial
    if (AD_BRAND_CATEGORIES.has(brand.category)) {
      conflicts.push({
        tag: tagName,
        brand: brand.name,
        conflict: `${videoCategory.label} + ${brand.category}品牌(${brand.name})`,
      });
    }
  }

  return conflicts;
}
