// Runs in the page's own JavaScript world (MAIN), before claude.ai's scripts, so a
// tab with auto-accept switched on keeps working while it is hidden: in another tab,
// minimised, or behind another window.
//
// A hidden tab doesn't render, so the browser skips the work the page relies on to
// notice a scroll: requestAnimationFrame callbacks, IntersectionObserver callbacks
// and the scroll events of a programmatic scroll. The content script (another JS
// world, same DOM) talks to this file with DOM events:
//
//   "claude-utilities:awake"  report the page as visible and focused, and hold
//                             back the events saying otherwise;
//   "claude-utilities:asleep" undo that.
//   "claude-utilities:flush"  while the tab isn't rendering: run pending animation
//                             frames and, for observed elements inside the event's
//                             target, the IntersectionObserver checks rendering would do.
//
// It emits "claude-utilities:visibility" when the tab is shown or hidden, because
// the real visibilitychange event is held back while awake.
//
// Until one of those events arrives, everything here passes straight through.
(() => {
  if (window.__claudeUtilitiesBridge) return;
  window.__claudeUtilitiesBridge = true;

  const P = "claude-utilities:";
  const proto = (name) => Object.getOwnPropertyDescriptor(Document.prototype, name);
  const hiddenGetter = proto("hidden").get;
  const stateGetter = proto("visibilityState").get;
  const realHidden = () => hiddenGetter.call(document);
  const nativeHasFocus = Document.prototype.hasFocus;
  let awake = false;

  // --- Visibility and focus ---------------------------------------------------
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => (awake ? false : realHidden()),
  });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (awake ? "visible" : stateGetter.call(document)),
  });
  document.hasFocus = function hasFocus() {
    return awake || nativeHasFocus.call(this);
  };

  // Registered before any page script, so these run first and can stop the event.
  window.addEventListener(
    "visibilitychange",
    (e) => {
      document.dispatchEvent(new CustomEvent(P + "visibility"));
      if (awake) e.stopImmediatePropagation();
    },
    true
  );
  window.addEventListener(
    "blur",
    (e) => {
      // Only the window's own blur; elements still get theirs.
      if (awake && e.target === window) e.stopImmediatePropagation();
    },
    true
  );

  // Separate event names, because an event's `detail` doesn't cross between worlds.
  document.addEventListener(P + "awake", () => {
    awake = true;
  });
  document.addEventListener(P + "asleep", () => {
    awake = false;
  });

  // --- Animation frames ---------------------------------------------------------
  // Same behaviour as the browser's, but pending callbacks can be run on demand.
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCaf = window.cancelAnimationFrame.bind(window);
  const frames = new Map(); // our id -> { callback, nativeId }
  let nextFrame = 1;

  window.requestAnimationFrame = function requestAnimationFrame(callback) {
    const id = nextFrame++;
    const nativeId = nativeRaf((time) => {
      if (frames.delete(id)) callback(time);
    });
    frames.set(id, { callback, nativeId });
    return id;
  };
  window.cancelAnimationFrame = function cancelAnimationFrame(id) {
    const frame = frames.get(id);
    if (!frame) return;
    frames.delete(id);
    nativeCaf(frame.nativeId);
  };

  function runFrames() {
    const batch = [...frames.values()];
    frames.clear();
    const now = performance.now();
    for (const { callback, nativeId } of batch) {
      nativeCaf(nativeId);
      try {
        callback(now);
      } catch (err) {
        setTimeout(() => {
          throw err;
        });
      }
    }
  }

  // --- IntersectionObserver -----------------------------------------------------
  const NativeIO = window.IntersectionObserver;
  const observers = new Set(); // WeakRef<observer> with at least one target

  if (NativeIO) {
    class IntersectionObserver extends NativeIO {
      #callback;
      #options;
      #targets = new Set(); // WeakRef<Element>
      #last = new WeakMap(); // target -> threshold level last reported
      #ref = new WeakRef(this);

      constructor(callback, options = {}) {
        let self = null;
        super((entries, observer) => {
          for (const entry of entries) self?.#last.set(entry.target, self.#level(entry));
          callback.call(observer, entries, observer);
        }, options);
        self = this;
        this.#callback = callback;
        this.#options = options ?? {};
      }
      observe(target) {
        super.observe(target);
        if (![...this.#targets].some((r) => r.deref() === target)) this.#targets.add(new WeakRef(target));
        observers.add(this.#ref);
      }
      unobserve(target) {
        super.unobserve(target);
        for (const r of this.#targets) if (r.deref() === target) this.#targets.delete(r);
        if (!this.#targets.size) observers.delete(this.#ref);
      }
      disconnect() {
        super.disconnect();
        this.#targets.clear();
        observers.delete(this.#ref);
      }

      #level(entry) {
        if (!entry.isIntersecting) return -1;
        return this.thresholds.filter((t) => entry.intersectionRatio >= t).length;
      }

      // Computes what rendering would report for targets inside `scope`, and calls
      // back for those whose state changed.
      check(scope) {
        const entries = [];
        for (const ref of this.#targets) {
          const target = ref.deref();
          if (!target) {
            this.#targets.delete(ref);
            continue;
          }
          if (!target.isConnected || !scope.contains(target)) continue;
          const entry = measure(target, this.#options);
          const level = this.#level(entry);
          if (this.#last.get(target) === level) continue;
          this.#last.set(target, level);
          entries.push(entry);
        }
        if (entries.length) this.#callback.call(this, entries, this);
      }
    }
    window.IntersectionObserver = IntersectionObserver;
  }

  const rect = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const clip = (a, b) => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  });
  const domRect = (r) =>
    new DOMRectReadOnly(r.left, r.top, Math.max(0, r.right - r.left), Math.max(0, r.bottom - r.top));

  // rootMargin as top/right/bottom/left in px ("10px 20%" etc.).
  function margins(value, box) {
    const parts = String(value ?? "0px").trim().split(/\s+/);
    const [t, r = t, b = t, l = r] = parts;
    const px = (v, size) => (v?.endsWith("%") ? (parseFloat(v) / 100) * size : parseFloat(v) || 0);
    const w = box.right - box.left;
    const h = box.bottom - box.top;
    return { top: px(t, h), right: px(r, w), bottom: px(b, h), left: px(l, w) };
  }

  function measure(target, options) {
    const root = options.root instanceof Element ? options.root : null;
    const bounds = target.getBoundingClientRect();
    let rootBox = root
      ? rect(root.getBoundingClientRect())
      : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const m = margins(options.rootMargin, rootBox);
    rootBox = {
      left: rootBox.left - m.left,
      top: rootBox.top - m.top,
      right: rootBox.right + m.right,
      bottom: rootBox.bottom + m.bottom,
    };

    let area = rect(bounds);
    for (let a = target.parentElement; a && a !== root && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX !== "visible" || s.overflowY !== "visible") area = clip(area, a.getBoundingClientRect());
    }
    area = clip(area, rootBox);

    const inRoot = !root || root.contains(target);
    // Edge-adjacent counts as intersecting, as in the spec (zero-height sentinels).
    const isIntersecting = inRoot && area.right >= area.left && area.bottom >= area.top;
    const targetArea = bounds.width * bounds.height;
    const shownArea = isIntersecting ? (area.right - area.left) * (area.bottom - area.top) : 0;
    const intersectionRatio = targetArea > 0 ? Math.min(1, shownArea / targetArea) : isIntersecting ? 1 : 0;

    return {
      target,
      time: performance.now(),
      isIntersecting,
      intersectionRatio,
      boundingClientRect: bounds,
      intersectionRect: isIntersecting ? domRect(area) : new DOMRectReadOnly(0, 0, 0, 0),
      rootBounds: domRect(rootBox),
    };
  }

  // --- Flush ----------------------------------------------------------------------
  // The browser can also stop rendering a tab it still reports as visible (e.g. one
  // that is covered or minimised on some systems). A native frame that was asked for
  // and hasn't come within a short while means rendering is stalled too.
  let probeAt = 0;
  function renderingStalled() {
    if (realHidden()) return true;
    const now = performance.now();
    if (probeAt && now - probeAt > 150) return true;
    if (!probeAt) {
      probeAt = now;
      nativeRaf(() => {
        probeAt = 0;
      });
    }
    return false;
  }

  document.addEventListener(
    P + "flush",
    (e) => {
      if (!renderingStalled()) return; // the browser is rendering and does this itself
      runFrames();
      const scope = e.target;
      if (!(scope instanceof Element) || scope === document.documentElement) return;
      for (const ref of [...observers]) {
        const observer = ref.deref();
        if (!observer) observers.delete(ref);
        else
          try {
            observer.check(scope);
          } catch {}
      }
    },
    true
  );
})();
