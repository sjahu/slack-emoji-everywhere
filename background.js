import { get_user_added_match_patterns } from "./optional_host_permissions.js";
import * as emojiCache from "./emoji_url_cache.js";

const EMOJI_URL_REGEX = /^(?<url>https:\/\/[a-zA-Z0-9_\-\/.%]+)$/
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // Refresh emoji URLs older than this
const SEARCH_COUNT = 25;

browser.storage.local.get(["slackConfig", "selectedTeamId"]).then((item) => {
  let team = item.slackConfig?.teams[item.selectedTeamId];

  if (team) {
    browser.runtime.onMessage.addListener((request) => {
      switch (request.type) {
        case "getEmoji":
          return handleGetEmoji(team, request.emojiNames);
        case "searchEmoji":
          return handleSearchEmoji(team, request.query);
      }
    });

    get_user_added_match_patterns().then((patterns) => {
      if (patterns.length) {
        registerContentScripts(patterns);
      }
    });
  }
});

async function handleGetEmoji(team, emojiNames) {
  const cachedEmojis = await emojiCache.get(emojiNames);

  const updatedEmojis = await fetchAndCacheEmojis(
    team,
    filterMissingOrOldEmojis(emojiNames, cachedEmojis)
  );

  return Object.values({ ...cachedEmojis, ...updatedEmojis }).reduce(
    (newObj, obj) => (newObj[obj.name] = obj.value, newObj),
    {}
  ); // returns { "emoji1": "https://...", "emoji2": "https://..." ... }
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

async function fetchAndCacheEmojis(team, emojis) {
  if (Object.keys(emojis).length) {
    const data = await fetchEmojisFromApi(team, emojis);

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
  } else {
    return {};
  }
}

async function fetchEmojisFromApi(team, emojis) {
  const response = await fetch(`https://edgeapi.slack.com/cache/${team.enterprise_id}/${team.id}/emojis/info`, {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": JSON.stringify({
      "token": team.token,
      "updated_ids": Object.values(emojis).reduce(
        (newObj, emoji) => (newObj[emoji.name] = emoji.updated, newObj),
        {}
      ) // map emojis to { "oldEmoji": 1596964923, "missingEmoji": 0, etc. }
      // the API only returns URLs for emoji for which our "updated" value is out-of-date
    })
  });

  return await response.json();
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

async function handleSearchEmoji(team, query) {
  const data = await fetchSearchResultsFromApi(team, query);

  let emojis = data.results.map((result) => {
    return {
      name: result.name,
      updated: result.updated,
      value: result.value.match(EMOJI_URL_REGEX)?.groups.url, // make sure the emoji URL is actually a URL
    };
  });

  emojiCache.put(Object.values(emojis));

  return emojis;
}

async function fetchSearchResultsFromApi(team, query) {
  const response = await fetch(`https://edgeapi.slack.com/cache/${team.enterprise_id}/${team.id}/emojis/search`, {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": JSON.stringify({
      "token": team.token,
      "count": SEARCH_COUNT,
      "query": query
    })
  });

  return await response.json();
}
