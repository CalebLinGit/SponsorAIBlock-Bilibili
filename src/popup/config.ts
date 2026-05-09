export const DEFAULT_CONFIG = {
  apiKey: '',
  aiModel: 'gemini-2.5-flash',
  autoSkip: true,
  ignoreVideoLessThan5Minutes: true,
  radarEnabled: true,
  hardAdAction: 'auto_skip' as const,
  integratedAdAction: 'prompt' as const,
  confidenceThreshold: 0.6,
};
