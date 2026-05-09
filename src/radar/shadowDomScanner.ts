export interface GoodsLinkResult {
  found: boolean;
  brand?: string;
  anchorText?: string;
  pinnedCommentText?: string;
}

// Module-level state so disconnectShadowObserver() can clean up
let activeObserver: MutationObserver | null = null;
let activeTimeout: ReturnType<typeof setTimeout> | null = null;
let visibilityHandler: (() => void) | null = null;
let hiddenSince: number | null = null;
let activeResolve: ((result: GoodsLinkResult) => void) | null = null;

const SCAN_TIMEOUT_MS = 30_000;
const VISIBILITY_HIDDEN_LIMIT_MS = 60_000;

/**
 * Recursively queries a selector through Shadow DOM boundaries.
 */
function recursiveQueryShadow(root: Element | ShadowRoot | Document, selector: string): Element[] {
  const results: Element[] = [];

  // Query in current root
  root.querySelectorAll(selector).forEach((el) => results.push(el));

  // Recurse into shadow roots of all children
  const allElements = root.querySelectorAll('*');
  allElements.forEach((el) => {
    if (el.shadowRoot) {
      recursiveQueryShadow(el.shadowRoot, selector).forEach((r) => results.push(r));
    }
  });

  return results;
}

/**
 * Extracts a brand hint from the anchor text or nearby container text.
 * Tries to get the first meaningful word segment (e.g., brand name before a dash or space).
 */
function extractBrand(anchor: Element, commentContainer: Element | null): string | undefined {
  const anchorText = anchor.textContent?.trim();
  if (anchorText) {
    // Often brand is the first token in "品牌名 - 商品名" patterns
    const firstToken = anchorText.split(/[\s\-—–|]/)[0].trim();
    if (firstToken) return firstToken;
  }
  return undefined;
}

/**
 * Finds the nearest comment container element walking up the DOM.
 */
function findCommentContainer(el: Element): Element | null {
  let current: Element | null = el;
  while (current) {
    const tag = current.tagName?.toLowerCase();
    if (
      tag === 'bili-comment-thread-renderer' ||
      tag === 'bili-comment' ||
      current.classList.contains('comment-item') ||
      current.classList.contains('reply-item')
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function scanForGoods(): GoodsLinkResult | null {
  const links = recursiveQueryShadow(document, 'a[data-type="goods"]');
  if (links.length === 0) return null;

  const anchor = links[0];
  const anchorText = anchor.textContent?.trim();
  const commentContainer = findCommentContainer(anchor);
  const pinnedCommentText = commentContainer?.textContent?.trim();
  const brand = extractBrand(anchor, commentContainer);

  return {
    found: true,
    brand,
    anchorText,
    pinnedCommentText,
  };
}

function cleanup(): void {
  if (activeObserver) {
    activeObserver.disconnect();
    activeObserver = null;
  }
  if (activeTimeout !== null) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  hiddenSince = null;
  activeResolve = null;
}

export function scanShadowDom(): Promise<GoodsLinkResult> {
  // Clean up any previous scan
  cleanup();

  return new Promise<GoodsLinkResult>((resolve) => {
    let resolved = false;

    function resolveOnce(result: GoodsLinkResult): void {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    }

    activeResolve = resolveOnce;

    // (1) Initial synchronous scan
    const initialResult = scanForGoods();
    if (initialResult) {
      resolveOnce(initialResult);
      return;
    }

    // (2) Set up MutationObserver
    const observer = new MutationObserver(() => {
      const result = scanForGoods();
      if (result) {
        resolveOnce(result);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    activeObserver = observer;

    // (3) Set 30-second timeout
    activeTimeout = setTimeout(() => {
      resolveOnce({ found: false });
    }, SCAN_TIMEOUT_MS);

    // (4) Visibility hidden > 60s → disconnect
    hiddenSince = null;
    visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSince = Date.now();
      } else {
        // Became visible again — check if we were hidden long enough
        if (hiddenSince !== null && Date.now() - hiddenSince > VISIBILITY_HIDDEN_LIMIT_MS) {
          resolveOnce({ found: false });
        }
        hiddenSince = null;
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  });
}

export function disconnectShadowObserver(): void {
  if (activeResolve) {
    activeResolve({ found: false });
  } else {
    cleanup();
  }
}
