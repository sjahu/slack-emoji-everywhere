import { browser } from "./browser_polyfill.js";
import { get_user_added_match_patterns } from "./optional_host_permissions.js";

export async function registerContentScripts() {
  let patterns = await get_user_added_match_patterns();

  let script = {
    id: "emoji",
    matches: patterns,
    excludeMatches: [
      "https://app.slack.com/*"
    ],
    js: [
      "emoji.js"
    ],
    css: [
      "emoji.css"
    ],
    runAt: "document_idle",
    persistAcrossSessions: true
  };

  let registeredScripts = await browser.scripting.getRegisteredContentScripts({ ids: ["emoji"]});

  if (patterns.length) {
    if (registeredScripts.length) {
      browser.scripting.updateContentScripts([script]);
    } else {
      browser.scripting.registerContentScripts([script]);
    }
  } else {
    if (registeredScripts.length) {
      browser.scripting.unregisterContentScripts({ ids: ["emoji"]});
    }
  }
}
