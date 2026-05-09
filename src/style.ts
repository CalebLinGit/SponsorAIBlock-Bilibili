export const thinkingAnimationClass = 'sai-thinking';
export const warningAnimationClass = 'sai-warning';
export const skipAnimationClass = 'sai-skip';

export function aboutToSkipAdStyle(): string {
  return '';
}

export function thinkingStyle(): string {
  return '';
}

export function warningStyle(): string {
  return '';
}

export function initializeAdBarStyle(left: number, width: number): string {
  return `position:absolute;top:0;left:${left}px;width:${width}px;height:100%;background:rgba(255,68,68,0.6);pointer-events:none;z-index:10;`;
}
