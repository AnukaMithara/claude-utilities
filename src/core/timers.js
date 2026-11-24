// Timers that stay on time in a hidden tab.
//
// The browser throttles timers in background tabs (to once a second, then once a
// minute after a few minutes), which would stretch a 3-second countdown into
// minutes. While the tab is hidden, wait() also asks the background worker to
// answer after `ms`; its reply arrives as a message, which isn't throttled.
(() => {
  ClaudeUtilities.wait = (ms) =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      if (!document.hidden) return;
      try {
        chrome.runtime
          .sendMessage({ type: "wait", ms })
          .then(() => {
            clearTimeout(timer);
            resolve();
          })
          .catch(() => {});
      } catch {} // extension reloaded: the timer still resolves
    });
})();
