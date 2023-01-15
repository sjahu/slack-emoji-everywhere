import { get_user_added_match_patterns } from "./optional_host_permissions.js";

const emojiUrlRegex = /^https:\/\/[a-zA-Z0-9_\-\/.]+$/

browser.storage.local.get(["slackConfig", "selectedTeamId"]).then((item) => {
  let team = item.slackConfig?.teams[item.selectedTeamId];
  if (team) {
    browser.runtime.onMessage.addListener((request) => {
      if (request.type === "getEmoji") {
        return fetch(`https://edgeapi.slack.com/cache/${team.enterprise_id}/${team.id}/emojis/info`, {
          "method": "POST",
          "headers": {
            "Content-Type": "application/json"
          },
          "body": JSON.stringify({
            "token": team.token,
            "updated_ids": request.emojiNames.reduce((acc, curr) => (acc[curr] = 0, acc), {}) // { "emoji1": 0, "emoji2": 0, etc }
          })
        }).then((response) => response.json()).then((data) => {
          let results = {};
          data.results.forEach(emojiResult => {
            // Make sure the emoji URL string is actually a URL before passing it to the content script
            if (emojiResult.value.match(emojiUrlRegex)) {
              results[emojiResult.name] = emojiResult.value;
            }
          });

          return results;
        });
      }
    });

    get_user_added_match_patterns().then((patterns) => {
      if (patterns.length) {
        browser.scripting.registerContentScripts(
          [
            {
              id: "not-slack",
              matches: patterns,
              excludeMatches: [
                "https://app.slack.com/*"
              ],
              js: [
                "not-slack.js"
              ],
              css: [
                "slack-emoji-everywhere.css"
              ],
              runAt: "document_idle"
            }
          ]
        );
      }
    });
  }
});
