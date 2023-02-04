# Custom emoji API support

Can't or don't want to use Slack to host custom emoji? `slack-emoji-everywhere` supports fetching emoji info from a custom API server.

Configure the custom API in the extensions options by providing the URL and a (secret, unique) token.

The API server must implement the following two endpoints:

## `emojis/info`

Accepts: `application/json`

### Request payload

- "token" (string, required): a string which is a valid access token (for some definition of valid determined by the server)
- "updated_ids" (object, required): an object containing 0 or more key-value-pairs
  - key (string): an emoji name
  - value (integer): either 0 or the last timestamp returned for that emoji by the server

Example:

```json
{
  "token": "super-secret-token-string",
  "updated_ids": {
    "emoji_name1": 1675206189,
    "emoji_name2": 0,
    "bad_emoji_name": 0
  }
}
```

### Response payload

- "failed_ids" (array, optional): any emoji names from the request that don't exist on the server
- "results" (array, required): an array of emoji objects (see below)
  - the API may return only emoji with a current "updated" timestamp newer than the value in the request
- "ok" (boolean, required): true if the request succeeded (even if results is empty)
- "error" (string, optional): if "ok" is false, a description of the error (e.g. "invalid_auth")

Example:

```json
{
  "failed_ids": ["bad_emoji_name"],
  "results": [
    {
      "name": "emoji_name2",
      "value": "https://cdn.example.com/images/emoji_name2.png",
      "updated": 1675206200
    }
  ],
  "ok":true
}
```

## `emojis/search`

Accepts: `application/json`

### Request payload

- "token" (string, required): a string which is a valid access token (for some definition of valid determined by the server)
- "query" (string, optional): the query string (i.e. what the user has typed in the emoji picker)
- "count" (integer, optional): the number of results to return

Example:

```json
{
  "token": "super-secret-token-string",
  "query": "party",
  "count": 25
}
```

### Response payload

- "results" (array, required): an array of emoji objects (see below)
- "ok" (boolean, required): true if the request succeeded (even if results is empty)
- "error" (string, optional): if "ok" is false, a description of the error (e.g. "invalid_auth")

Example:

```json
{
  "results": [
    {
      "name": "partyblob",
      "value": "https://cdn.example.com/images/partyblob.png",
      "updated": 1675201337
    }
  ],
  "ok": true
}
```

## Emoji object

There are a few different types of emoji objects. It's up to the server to decide which to implement (the first is the most common and the most useful).

### Regular custom emoji

- "name" (string): the emoji name
- "value" (string): the URL of the emoji image
- "updated" (integer): the timestamp of the last time the emoji was updated (i.e. last upload)

Example:

```json
{
  "name": "partyblob",
  "value": "https://cdn.example.com/images/partyblob.png",
  "updated": 1675201337
}
```

### Alias to custom emoji

- "name" (string): the alias name
- "value" (string): the URL of the emoji image
- "alias" (string): the name of the original custom emoji
- "updated" (integer): the timestamp of the last time the emoji was updated (i.e. last upload)
- "is_alias" (boolean): true

Example:

```json
{
  "name": "alias-partyblob",
  "value": "https://cdn.example.com/images/partyblob.png",
  "alias": "partyblob",
  "updated": 1675485402,
  "is_alias": true
}
```

Note: aliases to custom emoji "just work" as far as the extension is concerned. We only look at the name and value and don't need to care that an alias to another custom emoji is an alias.

### Alias to native emoji

- "name" (string): the alias name
- "value" (string): a string in the format "alias:native_emoji_name"
- "alias" (string): the name of the original native emoji
- "updated" (integer): the timestamp of the last time the emoji was updated (i.e. last upload)
- "is_alias" (boolean): true

Example:

```json
{
  "name": "alias-slightly-smiling-face",
  "value": "alias:slightly_smiling_face",
  "alias": "slightly_smiling_face",
  "updated": 1675485423,
  "is_alias": true
}
```

Note: aliases to native emoji are currently ignored by the extension since native emoji aren't supported either.
