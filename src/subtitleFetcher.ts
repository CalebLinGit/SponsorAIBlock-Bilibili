import { convertSubtitleObjToStr, subtitle } from './util';

export async function fetchSubtitleString(response: any): Promise<string | null> {
  try {
    if (!response.data?.subtitle?.subtitles?.length) {
      console.log('SAI: No subtitles found in response');
      return null;
    }

    const subtitles = response.data.subtitle.subtitles;
    const targetSubtitle = subtitles[0];

    if (!targetSubtitle.subtitle_url) {
      console.error('SAI: Unable to get the subtitle url from', subtitles);
      return null;
    }

    const fullUrl = targetSubtitle.subtitle_url.startsWith('//')
      ? 'https:' + targetSubtitle.subtitle_url
      : targetSubtitle.subtitle_url;

    console.log(`SAI: Subtitle language: ${targetSubtitle.lan_doc} (${targetSubtitle.lan})`);
    console.log(`SAI: Subtitle URL: ${fullUrl}`);

    const jsonRes = await (await fetch(fullUrl)).json();
    const subtitlesRes: subtitle[] = jsonRes.body;
    const subtitleStr = convertSubtitleObjToStr(subtitlesRes);

    return subtitleStr;
  } catch (error) {
    console.error('SAI: Error fetching subtitle string:', error);
    return null;
  }
}
