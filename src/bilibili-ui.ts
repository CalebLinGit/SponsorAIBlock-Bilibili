import { skipAnimationClass, aboutToSkipAdStyle, initializeAdBarStyle, thinkingStyle, warningStyle } from './style';
import { config } from './config';
import type { AdSegment } from './storage/cache';
import type { UserConfig } from './config';
import { showToast } from './toast';

export const progressWrapClassSelector = '.bpx-player-progress-schedule';
export const skipAdBarClass = 'sai-ad-bar';
export const playerContainerSelector = '.bpx-player-container';
export const playWrapId = 'bilibili-player';

// Cleanup tracking system
let resizeObservers: ResizeObserver[] = [];
let eventListeners: Array<{ target: EventTarget; type: string; listener: EventListener }> = [];
let intervals: number[] = [];
let timeouts: number[] = [];
let videoEventListeners: Array<{ video: HTMLVideoElement; type: string; listener: EventListener }> = [];

// Style IDs
const SKIP_STYLES_ID = 'sai-skip-animation-styles';
const THINKING_STYLES_ID = 'sai-thinking-animation-styles';
const WARNING_STYLES_ID = 'sai-warning-animation-styles';
const PROMPT_OVERLAY_STYLES_ID = 'sai-prompt-overlay-styles';

function injectPromptOverlayStyles(): void {
  if (!document.getElementById(PROMPT_OVERLAY_STYLES_ID)) {
    const style = document.createElement('style');
    style.id = PROMPT_OVERLAY_STYLES_ID;
    style.textContent = `
      .sai-ad-bar-hard {
        background: rgba(255, 68, 68, 0.7) !important;
      }
      .sai-ad-bar-integrated {
        background: rgba(255, 153, 0, 0.7) !important;
      }
      .sai-prompt-overlay {
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: rgba(28, 31, 43, 0.95);
        color: #fff;
        border-radius: 8px;
        padding: 12px 16px;
        z-index: 9999;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      }
      .sai-prompt-overlay .sai-prompt-text {
        margin-bottom: 4px;
      }
      .sai-prompt-overlay .sai-prompt-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .sai-prompt-overlay button {
        padding: 4px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .sai-prompt-overlay .sai-btn-skip {
        background: #ff4444;
        color: #fff;
      }
      .sai-prompt-overlay .sai-btn-ignore {
        background: #444;
        color: #ccc;
      }
    `;
    document.head.appendChild(style);
  }
}

export function injectSkipAnimationStyles(): void {
  if (!document.getElementById(SKIP_STYLES_ID)) {
    const style = document.createElement('style');
    style.id = SKIP_STYLES_ID;
    style.textContent = aboutToSkipAdStyle();
    document.head.appendChild(style);
  }

  if (!document.getElementById(THINKING_STYLES_ID)) {
    const thinkingStyleElement = document.createElement('style');
    thinkingStyleElement.id = THINKING_STYLES_ID;
    thinkingStyleElement.textContent = thinkingStyle();
    document.head.appendChild(thinkingStyleElement);
  }

  if (!document.getElementById(WARNING_STYLES_ID)) {
    const warningStyleElement = document.createElement('style');
    warningStyleElement.id = WARNING_STYLES_ID;
    warningStyleElement.textContent = warningStyle();
    document.head.appendChild(warningStyleElement);
  }

  injectPromptOverlayStyles();
}

function calculateAdBarPosition(
  adStartSeconds: number,
  adEndSeconds: number,
  videoDuration: number,
  progressBarWidth: number
): { left: number; width: number } {
  if (videoDuration <= 0) {
    console.error('SAI UI: Video duration is not valid', videoDuration);
    throw Error('Video duration is not valid');
  }

  if (progressBarWidth <= 0) {
    console.error('SAI UI: Progress bar width is not valid', progressBarWidth);
    throw Error('Progress bar width is not valid');
  }

  const startTime = Math.max(0, Math.min(adStartSeconds, videoDuration));
  const endTime = Math.max(startTime, Math.min(adEndSeconds, videoDuration));

  const leftPercent = startTime / videoDuration;
  const widthPercent = (endTime - startTime) / videoDuration;

  const left = leftPercent * progressBarWidth;
  const width = widthPercent * progressBarWidth;

  return { left, width };
}

function updateAdBarStyles(adStartSeconds: number, adEndSeconds: number): void {
  const adBars = Array.from(document.querySelectorAll(`.${skipAdBarClass}`)) as HTMLElement[];
  if (!adBars?.length) {
    return;
  }

  const progressWraps = Array.from(document.querySelectorAll(progressWrapClassSelector)) as HTMLElement[];
  const video = document.querySelector('video') as HTMLVideoElement;

  if (!progressWraps?.length || !video || !video.duration) {
    return;
  }

  for (const progressWrap of progressWraps) {
    const progressBarWidth = progressWrap.offsetWidth;
    const videoDuration = video.duration;

    const { left, width } = calculateAdBarPosition(
      adStartSeconds,
      adEndSeconds,
      videoDuration,
      progressBarWidth
    );

    const adBar = progressWrap.querySelector(`.${skipAdBarClass}`) as HTMLElement;
    if (!adBar) {
      return;
    }

    adBar.style.left = `${left}px`;
    adBar.style.width = `${width}px`;
  }
}

function createIndividualAdBar(
  progressWrap: HTMLElement,
  adStartSeconds: number,
  adEndSeconds: number,
  videoDuration: number,
  colorClass: string,
  labelSuffix: string = ''
): void {
  const progressBarWidth = progressWrap.offsetWidth;

  const { left, width } = calculateAdBarPosition(
    adStartSeconds,
    adEndSeconds,
    videoDuration,
    progressBarWidth
  );

  const existingAdBar = progressWrap.querySelector(`.${skipAdBarClass}`);
  if (existingAdBar) {
    existingAdBar.remove();
  }

  const adBar = document.createElement('div');
  adBar.className = `${skipAdBarClass} ${colorClass}`;
  adBar.style.cssText = initializeAdBarStyle(left, width);
  if (labelSuffix) {
    adBar.title = labelSuffix.trim();
  }

  const parentStyle = window.getComputedStyle(progressWrap);
  if (parentStyle.position === 'static') {
    progressWrap.style.position = 'relative';
  }

  progressWrap.appendChild(adBar);
  console.log(`SAI UI: Ad bar created: ${adStartSeconds}s - ${adEndSeconds}s (${left.toFixed(2)}px, ${width.toFixed(2)}px) [${colorClass}${labelSuffix}]`);
}

function createAdBar(adStartSeconds: number, adEndSeconds: number, colorClass: string, labelSuffix: string = ''): void {
  const progressWraps = Array.from(document.querySelectorAll(progressWrapClassSelector)) as HTMLElement[];

  if (!progressWraps?.length) {
    console.error('SAI UI: Progress bar not found');
    return;
  }

  const video = document.querySelector('video') as HTMLVideoElement;
  if (!video || !video.duration) {
    console.error('SAI UI: Video element or duration not found');
    return;
  }

  for (const progressWrap of progressWraps) {
    createIndividualAdBar(progressWrap, adStartSeconds, adEndSeconds, video.duration, colorClass, labelSuffix);
  }
}

function setupAdBarResizeHandlers(adStartSeconds: number, adEndSeconds: number): void {
  let resizeTimeout: number | null = null;

  const handleResize = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
      timeouts = timeouts.filter(id => id !== resizeTimeout!);
    }

    resizeTimeout = window.setTimeout(() => {
      updateAdBarStyles(adStartSeconds, adEndSeconds);
    }, 100);

    timeouts.push(resizeTimeout);
  };

  window.addEventListener('resize', handleResize);
  eventListeners.push({ target: window, type: 'resize', listener: handleResize as EventListener });

  const progressWrap = document.querySelector(progressWrapClassSelector);
  if (progressWrap) {
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(progressWrap);
    resizeObservers.push(resizeObserver);
  }

  const playerContainer = document.querySelector(playerContainerSelector);
  if (playerContainer) {
    const containerResizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    containerResizeObserver.observe(playerContainer);
    resizeObservers.push(containerResizeObserver);
  }
}

let commonAnimationElement: HTMLElement | null = null;

export function cleanupAll(): void {
  console.log('SAI UI: Starting cleanup...');

  const adBars = document.querySelectorAll(`.${skipAdBarClass}`);
  adBars.forEach(bar => bar.remove());

  if (commonAnimationElement) {
    commonAnimationElement.remove();
    commonAnimationElement = null;
  }

  const skipAnimations = document.querySelectorAll(`.${skipAnimationClass}`);
  skipAnimations.forEach(anim => anim.remove());

  // Remove prompt overlays
  const overlays = document.querySelectorAll('.sai-prompt-overlay');
  overlays.forEach(o => o.remove());

  resizeObservers.forEach(observer => observer.disconnect());
  resizeObservers = [];

  eventListeners.forEach(({ target, type, listener }) => {
    target.removeEventListener(type, listener);
  });
  eventListeners = [];

  videoEventListeners.forEach(({ video, type, listener }) => {
    video.removeEventListener(type, listener);
  });
  videoEventListeners = [];

  intervals.forEach(id => clearInterval(id));
  intervals = [];

  timeouts.forEach(id => clearTimeout(id));
  timeouts = [];

  console.log('SAI UI: Cleanup completed');
}

export function addAnimation(targetAnimationClass: string): void {
  injectSkipAnimationStyles();

  const playerWrap = document.getElementById(playWrapId) as HTMLElement;
  if (!playerWrap) {
    console.error('SAI UI: Player wrap not found');
    return;
  }

  if (commonAnimationElement) {
    commonAnimationElement.remove();
    commonAnimationElement = null;
  }

  commonAnimationElement = document.createElement('div');
  commonAnimationElement.classList.add(targetAnimationClass);
  playerWrap.appendChild(commonAnimationElement);
}

export function removeAnimation(): void {
  if (commonAnimationElement) {
    commonAnimationElement.remove();
    commonAnimationElement = null;
  }
}

function showPromptOverlay(
  video: HTMLVideoElement,
  segment: AdSegment,
  onSkip: () => void,
  onIgnore: () => void
): HTMLElement {
  const existing = document.querySelector('.sai-prompt-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'sai-prompt-overlay';
  overlay.innerHTML = `
    <div class="sai-prompt-text">检测到深度植入广告，是否跳过？</div>
    <div style="font-size:11px;color:#aaa;">${segment.reason}</div>
    <div class="sai-prompt-buttons">
      <button class="sai-btn-skip">跳过</button>
      <button class="sai-btn-ignore">忽略</button>
    </div>
  `;

  overlay.querySelector('.sai-btn-skip')!.addEventListener('click', () => {
    overlay.remove();
    onSkip();
  });

  overlay.querySelector('.sai-btn-ignore')!.addEventListener('click', () => {
    overlay.remove();
    onIgnore();
  });

  document.body.appendChild(overlay);
  return overlay;
}

function setupAutoSkipForSegment(
  video: HTMLVideoElement,
  segment: AdSegment,
  userConfig: UserConfig
): void {
  const { startTime: adStartSeconds, endTime: adEndSeconds, ad_type, confidence } = segment;

  const shouldAutoSkip =
    (ad_type === 'Hard_Ad' &&
      confidence >= userConfig.confidenceThreshold &&
      userConfig.hardAdAction === 'auto_skip') ||
    (ad_type === 'Integrated_Ad' && userConfig.integratedAdAction === 'auto_skip');

  const shouldPrompt =
    !shouldAutoSkip &&
    ((ad_type === 'Hard_Ad' && userConfig.hardAdAction === 'prompt') ||
      (ad_type === 'Integrated_Ad' && userConfig.integratedAdAction === 'prompt') ||
      confidence < userConfig.confidenceThreshold);

  let hasSkipped = false;
  let animationAdded = false;
  let promptShown = false;
  const ANIMATION_LEAD_TIME = 3;

  const playerWrap = document.querySelector(`#${playWrapId}`) as HTMLElement;
  let animationElement: HTMLElement | null = null;

  const addSkipAnimation = () => {
    if (playerWrap && !animationAdded && !animationElement) {
      animationElement = document.createElement('div');
      animationElement.classList.add(skipAnimationClass);
      playerWrap.appendChild(animationElement);
      animationAdded = true;
    }
  };

  const removeSkipAnimation = () => {
    if (animationElement && animationAdded) {
      animationElement.remove();
      animationElement = null;
      animationAdded = false;
    }
  };

  const handleTimeUpdate = () => {
    const currentTime = video.currentTime;
    const animationStartTime = Math.max(0, adStartSeconds - ANIMATION_LEAD_TIME);

    if (currentTime >= animationStartTime && currentTime < adEndSeconds && !animationAdded) {
      addSkipAnimation();
    }

    if (shouldAutoSkip) {
      if (currentTime >= adStartSeconds && currentTime < adEndSeconds && !hasSkipped) {
        console.log(`SAI UI: Auto-skipping ad: ${currentTime.toFixed(2)}s -> ${adEndSeconds}s`);
        video.currentTime = adEndSeconds;
        hasSkipped = true;
      }
    } else if (shouldPrompt && !promptShown) {
      if (currentTime >= adStartSeconds && currentTime < adEndSeconds) {
        promptShown = true;
        showPromptOverlay(
          video,
          segment,
          () => {
            video.currentTime = adEndSeconds;
            hasSkipped = true;
          },
          () => {
            // user chose to ignore
          }
        );
      }
    }

    if (hasSkipped && currentTime >= adEndSeconds) {
      removeSkipAnimation();
    }

    const resetBeforeTime = Math.max(0, adStartSeconds - ANIMATION_LEAD_TIME - 1);
    if (currentTime < resetBeforeTime || currentTime >= adEndSeconds + 1) {
      hasSkipped = false;
      promptShown = false;
      removeSkipAnimation();
    }
  };

  video.addEventListener('timeupdate', handleTimeUpdate);
  videoEventListeners.push({ video, type: 'timeupdate', listener: handleTimeUpdate as EventListener });
  console.log(`SAI UI: Skip handler set up for segment ${adStartSeconds}s-${adEndSeconds}s [${ad_type}, shouldAutoSkip=${shouldAutoSkip}]`);
}

export function initializeAdBar(
  segments: AdSegment[],
  userConfig: UserConfig,
  inputSource: 'subtitle' | 'danmaku' = 'subtitle'
): void {
  injectSkipAnimationStyles();

  if (!segments || segments.length === 0) {
    console.log('SAI UI: No segments to display');
    return;
  }

  if (inputSource === 'danmaku') {
    showToast('基于弹幕识别（精度可能略低于字幕）');
  }

  const video = document.querySelector('video') as HTMLVideoElement;

  if (!video) {
    console.log('SAI UI: Video element not found, checking again...');
    const checkVideo = window.setInterval(() => {
      const v = document.querySelector('video') as HTMLVideoElement;
      if (v) {
        console.log('SAI UI: Video element found, initializing ad bar...');
        clearInterval(checkVideo);
        intervals = intervals.filter(id => id !== checkVideo);
        initializeAdBar(segments, userConfig);
      }
    }, 500);
    intervals.push(checkVideo);
    return;
  }

  const createAndSetup = () => {
    const progressWrap = document.querySelector(progressWrapClassSelector);
    if (!progressWrap) {
      console.log('SAI UI: Progress wrap not found, checking again...');
      const timeout = window.setTimeout(createAndSetup, 200);
      timeouts.push(timeout);
      return;
    }

    for (const segment of segments) {
      const colorClass =
        segment.ad_type === 'Hard_Ad' ? 'sai-ad-bar-hard' : 'sai-ad-bar-integrated';
      const danmakuSuffix = inputSource === 'danmaku' ? ' 💬' : '';
      createAdBar(segment.startTime, segment.endTime, colorClass, danmakuSuffix);
      setupAdBarResizeHandlers(segment.startTime, segment.endTime);
      setupAutoSkipForSegment(video, segment, userConfig);
    }
  };

  if (video.readyState >= 2) {
    createAndSetup();
  } else {
    const checkVideoReady = window.setInterval(() => {
      if (video.readyState >= 2) {
        clearInterval(checkVideoReady);
        intervals = intervals.filter(id => id !== checkVideoReady);
        createAndSetup();
      }
    }, 100);
    intervals.push(checkVideoReady);
  }
}
