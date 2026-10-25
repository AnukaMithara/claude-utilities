// Activity log. Content scripts send entries to the background worker, which
// stores them in chrome.storage.local and drops anything older than a day.
ClaudeUtilities.log = (utility, message) =>
  chrome.runtime.sendMessage({ type: "log", utility, message }).catch(() => {});
