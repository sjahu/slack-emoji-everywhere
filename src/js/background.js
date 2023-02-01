import { browser } from "./lib/browser_polyfill.js";
import { get_user_added_match_patterns } from "./lib/optional_host_permissions.js";
import * as emojiCache from "./lib/emoji_url_cache.js";
import * as emojiApi from "./lib/emoji_api.js";

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // Refresh emoji URLs older than this

getTeam().then((team) => {
  if (team) {
    get_user_added_match_patterns().then((patterns) => {
      if (team && patterns.length) {
        registerContentScripts(patterns);
      }
    });
  }
});

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  getTeam().then((team) => {
    if (team) {
      switch (message.type) {
        case "getEmoji":
          handleGetEmoji(team, message.emojiNames).then(sendResponse);
        case "searchEmoji":
          handleSearchEmoji(team, message.query).then(sendResponse);
      }
    }
  });
  return true;
});

async function getTeam() {
  let item = await browser.storage.local.get(["slackConfig", "selectedTeamId"]);
  return item.slackConfig?.teams[item.selectedTeamId];
}

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
    const data = await emojiApi.info(team, emojis);

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
        value: result.value,
      };
    });

    emojiCache.put(Object.values(emojis)); // update any updated or deleted emoji, refresh the timestamp for the rest

    return emojis;
  } else {
    return {};
  }
}

function registerContentScripts(patterns) {
  browser.scripting.registerContentScripts(
    [
      {
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
        runAt: "document_idle"
      }
    ]
  );
}

async function handleSearchEmoji(team, query) {
  const data = await emojiApi.search(team, query);

  let emojis = data.results.map((result) => {
    return {
      name: result.name,
      updated: result.updated,
      value: result.value,
    };
  });

  emojiCache.put(Object.values(emojis));

  return emojis;
}
