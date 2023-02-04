const EMOJI_URL_REGEX = /^(?<url>https:\/\/[a-zA-Z0-9_\-\/.%]+)$/;
const SEARCH_COUNT = 25;
const EMOJI_ALIAS_REGEX = /^alias:(?<name>[a-z0-9_\-'+]{1,100})$/;

export async function info(team, emojis) {
  const data = await fetch(makeUrl(team, "info"), {
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
  }).then((response) => response.json());

  data.results.forEach((result) => {
    if (!result.value.match(EMOJI_URL_REGEX)?.groups.url) {
      console.error("Response from emoji server contains bad URL", data);
      throw new Error();
    }
  })

  return data;
}

export async function search(team, query) {
  const data = await fetch(makeUrl(team, "search"), {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": JSON.stringify({
      "token": team.token,
      "count": SEARCH_COUNT,
      "query": query
    })
  }).then((response) => response.json());

  data.results = data.results.filter(
    // Filter aliases to native emoji until those are supported
    // Aliases to custom emoji include a URL and can be treated normally
    // Also filter out non-string values... the API seems to sometimes return an object
    // e.g. { apple: "", google: "" } for the value
    // TODO: investigate. This definitely doesn't happen for all emoji-- I only saw this
    // happen for an emoji called :simple_smile:
    (result) => (typeof result.value == "string") && !result.value.match(EMOJI_ALIAS_REGEX)
  );

  data.results.forEach((result) => {
    if (!result.value.match(EMOJI_URL_REGEX)?.groups.url) {
      console.error("Response from emoji server contains bad URL", data);
      throw new Error();
    }
    return result;
  });

  return data;
}

function makeUrl(team, path) {
  if (team.customApiUrl) {
    return `${team.customApiUrl.replace(/\/$/, "")}/emojis/${path}`;
  } else if (team.enterprise_id) {
    return `https://edgeapi.slack.com/cache/${team.enterprise_id}/${team.id}/emojis/${path}`;
  } else {
    return `https://edgeapi.slack.com/cache/${team.id}/emojis/${path}`;
  }
}
