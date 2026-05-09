import { vi } from 'vitest';
import { scanShadowDom, disconnectShadowObserver } from '../../src/radar/shadowDomScanner';

describe('scanShadowDom', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Ensure any lingering observer from a previous test is cleared
    disconnectShadowObserver();
  });

  afterEach(() => {
    disconnectShadowObserver();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('resolves {found: false} after 30s timeout when no goods links exist', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';

    const promise = scanShadowDom();
    await vi.advanceTimersByTimeAsync(31_000);

    const result = await promise;
    expect(result).toEqual({ found: false });
  });

  it('resolves immediately {found: true} when goods link is already in a shadow root', async () => {
    // Create a custom element with an open shadow root containing a goods link
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<a data-type="goods">妙界按摩仪</a>`;
    document.body.appendChild(host);

    const result = await scanShadowDom();
    expect(result.found).toBe(true);
    expect(result.anchorText).toBe('妙界按摩仪');
  });

  it('extracts brand from goods link anchor text', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<a data-type="goods">元力象 - 高科技内衣</a>`;
    document.body.appendChild(host);

    const result = await scanShadowDom();
    expect(result.found).toBe(true);
    // extractBrand splits on whitespace/dash — first token should be "元力象"
    expect(result.brand).toBe('元力象');
  });

  it('resolves {found: true} for a goods link nested in 2 levels of shadow DOM', async () => {
    // Outer host → outer shadow → inner host → inner shadow → goods link
    const outerHost = document.createElement('div');
    const outerShadow = outerHost.attachShadow({ mode: 'open' });

    const innerHost = document.createElement('div');
    outerShadow.appendChild(innerHost);

    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    innerShadow.innerHTML = `<a data-type="goods">嵌套商品</a>`;

    document.body.appendChild(outerHost);

    const result = await scanShadowDom();
    expect(result.found).toBe(true);
    expect(result.anchorText).toBe('嵌套商品');
  });

  it('detects goods link added dynamically via MutationObserver', async () => {
    // Start with empty DOM — no goods link yet
    document.body.innerHTML = '<div id="comments"></div>';

    const promise = scanShadowDom();

    // Simulate Bilibili lazily injecting a comment with a goods link into the DOM
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<a data-type="goods">动态商品</a>`;
    document.getElementById('comments')!.appendChild(host);

    // MutationObserver callbacks fire asynchronously; yield to microtask/task queue
    const result = await promise;
    expect(result.found).toBe(true);
  });

  it('resolves {found: false} immediately when disconnectShadowObserver is called before timeout', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="app"></div>';

    const promise = scanShadowDom();

    // Disconnect immediately — resolves with {found: false} and cleans up
    disconnectShadowObserver();

    const result = await promise;
    expect(result).toEqual({ found: false });
  });
});
