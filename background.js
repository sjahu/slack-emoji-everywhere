import { get_user_added_match_patterns } from "./optional_host_permissions.js";
import * as emojiCache from "./emoji_url_cache.js";

const EMOJI_URL_REGEX = /^(?<url>https:\/\/[a-zA-Z0-9_\-\/.]+)$/
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

          let missingOrOld = missingEmojiNames.reduce(
            (obj, name) => (obj[name] = { name: name, value: null, updated: 0 }, obj),
            oldEmojiNames.reduce(
              (obj, name) => (obj[name] = cachedEmojiUrls[name], obj),
              {}
            )
          )

          let optionalApiCall = !Object.keys(missingOrOld).length ? Promise.resolve() :
            fetch(`https://edgeapi.slack.com/cache/${team.enterprise_id}/${team.id}/emojis/info`, {
              "method": "POST",
              "headers": {
                "Content-Type": "application/json"
              },
              "body": JSON.stringify({
                "token": team.token,
                "updated_ids": Object.entries(missingOrOld).reduce((newObj, [k, v]) =>
                  (newObj[k] = v.updated, newObj),
                  {}
                ) // map missing or old emoji to { "oldEmoji": 1596964923, "missingEmoji": 0, etc. }
                // the API only returns URLs for emoji for which our "updated" value is out-of-date
              })
            }).then((response) => response.json()).then((data) => {
              data.failed_ids?.forEach((failed_id) => {
                missingOrOld[failed_id] = {
                  name: failed_id,
                  updated: 0,
                  value: null,
                };
              });

              data.results?.forEach((result) => {
                missingOrOld[result.name] = {
                  name: result.name,
                  updated: result.updated,
                  value: result.value.match(EMOJI_URL_REGEX)?.groups.url, // make sure the emoji URL is actually a URL
                };
              });

              emojiCache.put(Object.values(missingOrOld)); // update any updated or deleted emoji, refresh the timestamp for the rest
            });

          return optionalApiCall.then(() => Object.values(missingOrOld).reduce( // combine new values from missingOrOld with
            (newObj, obj) => (newObj[obj.name] = obj.value, newObj), // existing values from cachedEmojiUrls
            Object.values(cachedEmojiUrls).reduce(
              (newObj, obj) => (newObj[obj.name] = obj.value, newObj),
              {}
            )
          ));
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
