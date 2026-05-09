export interface UserConfig {
  apiKey: string;
  aiModel: string;
  autoSkip: boolean;
  ignoreVideoLessThan5Minutes: boolean;
  radarEnabled: boolean;
  hardAdAction: 'auto_skip' | 'prompt';
  integratedAdAction: 'auto_skip' | 'prompt' | 'ignore';
  confidenceThreshold: number;
  enableDanmakuFallback: boolean;
  danmakuWindowSec: number;
}

export const DEFAULT_CONFIG: UserConfig = {
  apiKey: '',
  aiModel: 'gemini-2.5-flash',
  autoSkip: true,
  ignoreVideoLessThan5Minutes: true,
  radarEnabled: true,
  hardAdAction: 'auto_skip',
  integratedAdAction: 'prompt',
  confidenceThreshold: 0.6,
  enableDanmakuFallback: true,
  danmakuWindowSec: 5,
};

export let config: UserConfig = DEFAULT_CONFIG;

export function initializeConfig(inputUserConfig: UserConfig) {
  config = inputUserConfig;
}
