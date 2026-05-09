export interface SegmentRef {
  startTime: number;
  endTime: number;
}

export interface BvidOverrides {
  whitelist: SegmentRef[]; // "this is NOT an ad"
  blacklist: SegmentRef[]; // "this IS an ad"
}

const CORRECTION_KEY = 'SAI_CORRECTIONS';

async function getCorrections(): Promise<Record<string, BvidOverrides>> {
  const result = await chrome.storage.local.get(CORRECTION_KEY);
  return result[CORRECTION_KEY] || {};
}

async function saveCorrections(corrections: Record<string, BvidOverrides>): Promise<void> {
  await chrome.storage.local.set({ [CORRECTION_KEY]: corrections });
}

export async function addWhitelist(bvid: string, seg: SegmentRef): Promise<void> {
  const corrections = await getCorrections();
  const overrides = corrections[bvid] || { whitelist: [], blacklist: [] };
  overrides.whitelist.push(seg);
  corrections[bvid] = overrides;
  await saveCorrections(corrections);
  console.log(`SAI Corrections: Added whitelist entry for ${bvid}`, seg);
}

export async function addBlacklist(bvid: string, seg: SegmentRef): Promise<void> {
  const corrections = await getCorrections();
  const overrides = corrections[bvid] || { whitelist: [], blacklist: [] };
  overrides.blacklist.push(seg);
  corrections[bvid] = overrides;
  await saveCorrections(corrections);
  console.log(`SAI Corrections: Added blacklist entry for ${bvid}`, seg);
}

export async function getOverrides(bvid: string): Promise<BvidOverrides> {
  const corrections = await getCorrections();
  return corrections[bvid] || { whitelist: [], blacklist: [] };
}
