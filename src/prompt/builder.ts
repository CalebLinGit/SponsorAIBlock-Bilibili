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
  metadata: VideoMetadata,
  inputSource: 'subtitle' | 'danmaku' = 'subtitle'
): string {
  const blocks: string[] = [];

  // Block 1: Role + Task instruction (Chinese)
  const evidenceRule =
    inputSource === 'subtitle'
      ? `**字幕场景下的商业赞助证据**：置顶评论含商品链接、口播促销码/优惠码（"立减""下单""链接在评论区"）、明显由品牌方提供的话术（"本期视频由 X 赞助"、参数清单式介绍）、或雷达信号已命中商品链接/品牌词。`
      : `**弹幕场景下的商业赞助证据**：弹幕中出现"恰饭""广告""接广了""跳过""前方高能""避雷""充值""xx秒结束"等观众标记广告的词汇高频聚集，且时间窗集中在某一段 — 这是强信号。仅讨论产品/店家本身（如"想吃""好饿""真不错"）**不构成证据**，不要标注。`;

  blocks.push(
    `你是一个B站视频广告识别助手。给定视频字幕，识别其中的恰饭广告片段，输出每段广告的起止时间、类型和置信度。

重要规则：
- 「三连」「关注」「点赞」等互动号召 **不是广告**，不要标注
- **评测/探店/Vlog 类内容不是广告**：美食探店、产品测评、旅游 vlog、开箱体验等，UP主自主选题、对产品/店家进行体验或评价 — 即便整段视频围绕一个店家/产品，只要没有下述商业赞助证据，**一律不标注**，返回空 segments。
- Hard_Ad（插播硬广）：与正文话题完全断层，可独立删除不影响主线，典型：开头/中间突然介绍一个产品
- Integrated_Ad（深度植入）：广告产品是视频核心道具，**且**有明确商业赞助证据。仅产品出现/被使用不足以判定为广告。占视频比例>30%，不要自动跳过。
- ${evidenceRule}
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
    '字幕片段：[05:15-05:45]:本次旅行最重要的装备就是影石Insta360相机，本期视频由影石赞助。[06:00-07:30]:它的稳定性和防水性能在极端条件下表现完美，点击下方链接购买享受优惠。[07:31-08:00]:最后的成片效果非常满意。'
  );
  blocks.push(
    '识别结果：{"segments": [{"startTime": 315, "endTime": 450, "ad_type": "Integrated_Ad", "confidence": 0.85, "reason": "相机是视频核心工具，且有明确赞助声明和购买引导"}]}'
  );

  blocks.push('【示例5 - 非广告（探店）】');
  blocks.push('视频类型：美食探店');
  blocks.push(
    '字幕片段：[00:10-00:30]:今天来到一家评价不错的兰州拉面馆。[00:31-02:00]:面条很劲道，汤底浓郁，价格也很实惠，十五块钱一碗。[02:01-02:30]:总体来说值得推荐，感兴趣的可以来试试。'
  );
  blocks.push('雷达信号：无雷达信号，依赖语义分析');
  blocks.push(
    '识别结果：{"segments": []}，理由："探店类视频，UP主自主体验，无商业赞助证据，不标注"。'
  );

  if (inputSource === 'danmaku') {
    blocks.push('【示例6 - 弹幕广告警告】');
    blocks.push('视频类型：知识/科普');
    blocks.push(
      '弹幕片段：[02:00-02:30]: 恰饭来了 / 广告警告 / 跳过 / 前方高能 / 接广了 / 恰饭恰饭 / 可以快进了（密集出现）'
    );
    blocks.push(
      '识别结果：{"segments": [{"startTime": 120, "endTime": 180, "ad_type": "Hard_Ad", "confidence": 0.85, "reason": "弹幕高频出现观众广告标记词，时间窗集中"}]}'
    );
  }

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
    blocks.push('- 无雷达赞助证据，对 Integrated_Ad 判定应保持高保守度');
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

  // Block 5: Input content (subtitle or danmaku)
  if (inputSource === 'danmaku') {
    blocks.push('【弹幕内容】');
    blocks.push('以下文本为观众弹幕汇总（每段为该时间窗内的弹幕拼接），请基于弹幕语义识别广告区间。注意弹幕通常滞后于实际广告 1-3 秒。');
  } else {
    blocks.push('【字幕内容】');
  }
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
