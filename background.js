import { get_user_added_match_patterns } from "./optional_host_permissions.js";
import * as emojiCache from "./emoji_url_cache.js";

const EMOJI_URL_REGEX = /^https:\/\/[a-zA-Z0-9_\-\/.]+$/
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // Refresh emoji URLs older than this

browser.storage.local.get(["slackConfig", "selectedTeamId"]).then((item) => {
  let team = item.slackConfig?.teams[item.selectedTeamId];

  if (team) {
    browser.runtime.onMessage.addListener((request) => {
      if (request.type === "getEmoji") {
        return emojiCache.get(request.emojiNames).then((cachedEmojiUrls) => {
          let missingEmojiNames = request.emojiNames.filter(
            (name) => !(cachedEmojiUrls[name])
          );

          let oldEmojiNames = request.emojiNames.filter(
            (name) => cachedEmojiUrls[name] && Date.now() - cachedEmojiUrls[name]._timestamp > CACHE_TTL
          )

          let missingOrOldForApi = missingEmojiNames.concat(oldEmojiNames).reduce(
            (obj, name) => (obj[name] = cachedEmojiUrls[name]?.updated || 0, obj),
            {}
          ); // Map missing or old names to { "oldEmoji": 1596964923, "missingEmoji": 0, etc. }

          return fetch(`https://edgeapi.slack.com/cache/${team.enterprise_id}/${team.id}/emojis/info`, {
            "method": "POST",
            "headers": {
              "Content-Type": "application/json"
            },
            "body": JSON.stringify({
              "token": team.token,
              "updated_ids": missingOrOldForApi // The API only returns URLs for emoji for which our "updated" value is out-of-date
            })
          }).then((response) => response.json()).then((data) => {
            let newCacheEntries = [];

            data.results.forEach(emojiResult => {
              // Make sure the emoji URL value returned by the API is actually a URL
              // before saving it or passing it to the content script
              if (emojiResult.value.match(EMOJI_URL_REGEX)) {
                newCacheEntries.push(emojiResult);
                cachedEmojiUrls[emojiResult.name] = emojiResult;
              }
            });

            oldEmojiNames.filter((name) => !data.failed_ids.includes(name))
              .forEach((name) => newCacheEntries.push(cachedEmojiUrls[name])); // refresh cache timestamp for old emoji that still exist

            emojiCache.put(newCacheEntries);
            emojiCache.remove(data.failed_ids); // delete any out-of-date emoji that the API says no longer exist

            return Object.values(cachedEmojiUrls)
              .filter((obj) => !data.failed_ids.includes(obj.name))
              .reduce(
                (newObj, obj) => (newObj[obj.name] = obj.value, newObj),
                {}
              );
          });
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
