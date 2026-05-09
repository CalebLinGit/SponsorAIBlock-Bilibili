import type { RadarSignals } from '../storage/cache';

export interface VideoMetadata {
  title?: string;
  description?: string;
  tname?: string;
}

// Few-shot samples: BV1SDR3BJEJ3, BV1bcdPBeEoj, BV1csReBiEZc, BV1TFd3BEEB3
// Holdout set (DO NOT inject into prompt): BV1xTdwBQEna, BV1KAd3BjEDd, BV1PmRxBUEHF, BV1CpR1BiEru, BV1g9dgBpEcf

export function buildPrompt(
  subtitleStr: string,
  radarSignals: RadarSignals,
  metadata: VideoMetadata
): string {
  const blocks: string[] = [];

  // Block 1: Role + Task instruction (Chinese)
  blocks.push(
    `你是一个B站视频广告识别助手。给定视频字幕，识别其中的恰饭广告片段，输出每段广告的起止时间、类型和置信度。

重要规则：
- 「三连」「关注」「点赞」等互动号召 **不是广告**，不要标注
- Hard_Ad（插播硬广）：与正文话题完全断层，可独立删除不影响主线，典型：开头/中间突然介绍一个产品
- Integrated_Ad（深度植入）：广告产品就是视频的核心道具或解决方案，占视频比例>30%，不要自动跳过
- 置信度：0.0（完全不确定）到1.0（100%确定是广告）`
  );

  // Block 2: Few-shot examples
  blocks.push('【示例1 - Hard_Ad】');
  blocks.push('视频类型：历史/剧情');
  blocks.push(
    '字幕片段：[00:05-00:12]:今天继续讲述这段历史的故事。[00:45-01:10]:最近发现一款很舒服的按摩仪，叫妙界按摩仪，可以缓解腰椎疲劳。[01:11-01:20]:回到我们的历史叙述。'
  );
  blocks.push(
    '识别结果：{"segments": [{"startTime": 45, "endTime": 70, "ad_type": "Hard_Ad", "confidence": 0.95, "reason": "产品介绍与历史内容断层明显，可直接删除"}]}'
  );

  blocks.push('【示例2 - Hard_Ad】');
  blocks.push('视频类型：军事');
  blocks.push(
    '字幕片段：[02:15-02:45]:分析这场战役的战术意义和历史影响。[03:00-03:30]:提到一款非常舒适的内衣品牌元力象，采用高科技面料。[03:31-04:00]:继续分析战役的政治后果。'
  );
  blocks.push(
    '识别结果：{"segments": [{"startTime": 180, "endTime": 210, "ad_type": "Hard_Ad", "confidence": 0.92, "reason": "内衣品牌与军事内容完全无关，典型硬广插播"}]}'
  );

  blocks.push('【示例3 - Integrated_Ad】');
  blocks.push('视频类型：飞机改装/DIY');
  blocks.push(
    '字幕片段：[10:30-11:00]:使用荣威i6的发动机作为主要动力源。[11:01-12:30]:这款发动机的性能指标完全满足我们的改装需求，扭矩充足。[12:31-13:00]:完成安装后的测试结果令人满意。'
  );
  blocks.push(
    '识别结果：{"segments": [{"startTime": 630, "endTime": 750, "ad_type": "Integrated_Ad", "confidence": 0.88, "reason": "产品是视频核心道具，占比超30%，不自动跳过"}]}'
  );

  blocks.push('【示例4 - Integrated_Ad】');
  blocks.push('视频类型：旅游/冒险');
  blocks.push(
    '字幕片段：[05:15-05:45]:本次旅行最重要的装备就是影石Insta360相机。[06:00-07:30]:它的稳定性和防水性能在极端条件下表现完美，让我们记录了很多珍贵时刻。[07:31-08:00]:最后的成片效果非常满意。'
  );
  blocks.push(
    '识别结果：{"segments": [{"startTime": 315, "endTime": 450, "ad_type": "Integrated_Ad", "confidence": 0.85, "reason": "相机是视频记录的核心工具，内容与产品深度融合"}]}'
  );

  // Block 3: Radar signals injection
  const radarLines: string[] = [];
  if (radarSignals.hasGoodsLink && radarSignals.goodsBrand) {
    radarLines.push(
      `- 置顶评论含商品链接（品牌词：${radarSignals.goodsBrand}），强烈提示存在带货广告`
    );
  }
  if (radarSignals.chapterHits.length > 0) {
    const chapterNames = radarSignals.chapterHits.map((h) => h.name).join('、');
    radarLines.push(`- 章节关键词命中：${chapterNames}`);
  }
  if (radarSignals.tagConflicts.length > 0) {
    const conflicts = radarSignals.tagConflicts.map((c) => c.conflict).join('；');
    radarLines.push(`- Tag类目冲突：${conflicts}`);
  }
  if (radarSignals.pinnedCommentText) {
    radarLines.push(`- 置顶评论摘要：${radarSignals.pinnedCommentText.slice(0, 100)}`);
  }

  blocks.push('【雷达信号】');
  if (radarLines.length > 0) {
    blocks.push(...radarLines);
  } else {
    blocks.push('- 无雷达信号，依赖语义分析');
  }

  // Block 4: Video metadata
  const metadataLines: string[] = [];
  if (metadata.title) {
    metadataLines.push(`标题：${metadata.title}`);
  }
  if (metadata.tname) {
    metadataLines.push(`分类：${metadata.tname}`);
  }
  if (metadata.description) {
    const truncatedDesc = metadata.description.slice(0, 200);
    metadataLines.push(`描述：${truncatedDesc}`);
  }

  if (metadataLines.length > 0) {
    blocks.push('【视频信息】');
    blocks.push(...metadataLines);
  }

  // Block 5: Subtitle
  blocks.push('【字幕内容】');
  blocks.push('------');
  blocks.push(subtitleStr);
  blocks.push('------');

  // Block 6: Output instruction
  blocks.push('【输出格式】');
  blocks.push('严格返回 JSON，不要添加任何解释：');
  blocks.push(
    '{"segments": [{"startTime": <number>, "endTime": <number>, "ad_type": "Hard_Ad"|"Integrated_Ad", "confidence": <0.0-1.0>, "reason": "<简短原因>"}]}'
  );
  blocks.push('如果没有广告，返回：{"segments": []}');

  return blocks.join('\n');
}
