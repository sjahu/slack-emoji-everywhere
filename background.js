import { get_user_added_match_patterns } from "./optional_host_permissions.js";
import * as emojiCache from "./emoji_url_cache.js";

const EMOJI_URL_REGEX = /^(?<url>https:\/\/[a-zA-Z0-9_\-\/.]+)$/
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // Refresh emoji URLs older than this

browser.storage.local.get(["slackConfig", "selectedTeamId"]).then((item) => {
  let team = item.slackConfig?.teams[item.selectedTeamId];

  if (team) {
    browser.runtime.onMessage.addListener((request) => {
      switch (request.type) {
        case "getEmoji":
          return handleGetEmoji(team, request.emojiNames);
      }
    });

    get_user_added_match_patterns().then((patterns) => {
      if (patterns.length) {
        registerContentScripts(patterns);
      }
    });
  }
});

function handleGetEmoji(team, emojiNames) {
  return emojiCache.get(emojiNames).then((cachedEmojis) => // each emoji is an object like { "name": "emoji1", "updated": 1234567890, "value": "https://..." }
    fetchAndCacheEmojis(
      team,
      filterMissingOrOldEmojis(emojiNames, cachedEmojis)
    ).then((updatedEmojis) =>
      Object.values({ ...cachedEmojis, ...updatedEmojis })
        .reduce((newObj, obj) => (newObj[obj.name] = obj.value, newObj), {}) // returns { "emoji1": "https://...", "emoji2": "https://..." ... }
    )
  );
}

function filterMissingOrOldEmojis(emojiNames, cachedEmojis) {
  let missingEmojis = emojiNames.filter(
    (name) => !(cachedEmojis[name])
  ).reduce(
    (obj, name) => (obj[name] = { name: name, value: null, updated: 0 }, obj),
    {}
  );

  let oldEmojis = emojiNames.filter(
    (name) => cachedEmojis[name] && Date.now() - cachedEmojis[name]._timestamp > CACHE_TTL
  ).reduce(
    (obj, name) => (obj[name] = cachedEmojis[name], obj),
    {}
  );

  return { ...missingEmojis, ...oldEmojis };
}

function fetchAndCacheEmojis(team, emojis) {
  if (Object.keys(emojis).length) {
    return fetchEmojisFromApi(team, emojis).then((data) => {
      data.failed_ids?.forEach((failed_id) => {
        emojis[failed_id] = {
          name: failed_id,
          updated: 0,
          value: null,
        };
      });

      data.results?.forEach((result) => {
        emojis[result.name] = {
          name: result.name,
          updated: result.updated,
          value: result.value.match(EMOJI_URL_REGEX)?.groups.url, // make sure the emoji URL is actually a URL
        };
      });

      emojiCache.put(Object.values(emojis)); // update any updated or deleted emoji, refresh the timestamp for the rest

      return emojis;
    });
  } else {
    return Promise.resolve().then(() => new Object());
  }
}

function fetchEmojisFromApi(team, emojis) {
  return fetch(`https://edgeapi.slack.com/cache/${team.enterprise_id}/${team.id}/emojis/info`, {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": JSON.stringify({
      "token": team.token,
      "updated_ids": Object.entries(emojis).reduce((newObj, [k, v]) =>
        (newObj[k] = v.updated, newObj),
        {}
      ) // map emojis to { "oldEmoji": 1596964923, "missingEmoji": 0, etc. }
      // the API only returns URLs for emoji for which our "updated" value is out-of-date
    })
  }).then((response) => response.json());
}

function registerContentScripts(patterns) {
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
