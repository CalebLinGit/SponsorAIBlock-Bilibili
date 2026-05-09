import { GoogleGenAI } from '@google/genai';
import { showToast } from './toast';

export type { AdSegment } from './storage/cache';
import type { AdSegment } from './storage/cache';

export interface IdentifyAdOptions {
  geminiClient: GoogleGenAI;
  prompt: string; // fully constructed prompt from prompt/builder.ts
  aiModel: string;
}

const responseJsonSchema = {
  type: 'OBJECT',
  properties: {
    segments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          startTime: { type: 'NUMBER' },
          endTime: { type: 'NUMBER' },
          ad_type: { type: 'STRING', enum: ['Hard_Ad', 'Integrated_Ad'] },
          confidence: { type: 'NUMBER' },
          reason: { type: 'STRING' },
        },
        required: ['startTime', 'endTime', 'ad_type', 'confidence', 'reason'],
      },
    },
  },
  required: ['segments'],
};

export async function identifyAdSegments(options: IdentifyAdOptions): Promise<AdSegment[]> {
  const { geminiClient, prompt, aiModel } = options;

  if (!geminiClient || !aiModel) {
    console.error('SAI AI: Not initialized, cannot identify ads');
    showToast('SAI: AI not initialized');
    return [];
  }

  try {
    const response = await geminiClient.models.generateContent({
      model: aiModel,
      config: {
        responseJsonSchema,
        responseMimeType: 'application/json',
        httpOptions: {
          timeout: 1000 * 60,
        },
      },
      contents: prompt,
    });

    console.log('SAI AI: Response text', response.text);

    const parsed = JSON.parse(response.text!);
    const rawSegments: any[] = parsed?.segments ?? [];

    const validated: AdSegment[] = rawSegments.filter((seg: any) => {
      if (typeof seg.startTime !== 'number' || seg.startTime < 0) return false;
      if (typeof seg.endTime !== 'number' || seg.endTime <= seg.startTime) return false;
      if (typeof seg.confidence !== 'number' || seg.confidence < 0 || seg.confidence > 1) return false;
      if (seg.ad_type !== 'Hard_Ad' && seg.ad_type !== 'Integrated_Ad') return false;
      return true;
    });

    console.log(`SAI AI: Found ${validated.length} valid segment(s)`);
    return validated;
  } catch (err) {
    console.error('SAI AI: Failed to reach AI service:', err);
    showToast('SAI: AI service failed');
    return [];
  }
}

export async function checkGeminiConnectivity(
  geminiClient: GoogleGenAI,
  aiModel: string
): Promise<string | undefined> {
  try {
    const response = await geminiClient.models.generateContent({
      model: aiModel,
      config: {
        responseJsonSchema: {
          type: 'boolean',
        },
        responseMimeType: 'application/json',
        httpOptions: {
          timeout: 1000 * 15,
        },
      },
      contents: 'Hi',
    });
    return response.text;
  } catch (err) {
    console.error('SAI AI: Failed to reach AI service:', err);
    showToast('SAI: AI service failed');
    throw err;
  }
}
