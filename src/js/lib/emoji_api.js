const EMOJI_URL_REGEX = /^(?<url>https:\/\/[a-zA-Z0-9_\-\/.%]+)$/;
const SEARCH_COUNT = 25;
const EMOJI_ALIAS_REGEX = /^alias:(?<name>[a-z0-9_\-'+]{1,100})$/;

export async function info(team, emojis) {
  const data = await fetch(`https://edgeapi.slack.com/cache/${team.enterprise_id}/${team.id}/emojis/info`, {
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
  const data = await fetch(`https://edgeapi.slack.com/cache/${team.enterprise_id}/${team.id}/emojis/search`, {
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
    (result) => !result.value.match(EMOJI_ALIAS_REGEX) // Filter aliases to native emoji until those are supported
  ); // Aliases to custom emoji include a URL and can be treated normally

  data.results.forEach((result) => {
    if (!result.value.match(EMOJI_URL_REGEX)?.groups.url) {
      console.error("Response from emoji server contains bad URL", data);
      throw new Error();
    }
    return result;
  });

  return data;
}
