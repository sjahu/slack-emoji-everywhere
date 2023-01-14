const emojiRegex = /:([a-z0-9_\-]{1,100}):/g;

let emojiNames = new Set();

let nodeIterator = document.createNodeIterator(
  document,
  NodeFilter.SHOW_TEXT, // only consider text nodes
);
let nodes = [];
let node;
while (node = nodeIterator.nextNode()) {
  nodes.push(node);

  for (match of node.textContent.matchAll(emojiRegex)) {
    emojiNames.add(match[1]);
  }
}

// TODO: chunk emoji listing API calls
//       there doesn't appear to be a limit on the number of emojis per call, but there's a 10 000 byte limit on the size of the request body
browser.runtime.sendMessage({ type: "getEmoji", emojiNames: [...emojiNames] }).then((emojiUrls) => {
  for (const node of nodes) {
    let newNodeParent = document.createElement("div");

    newNodeParent.innerHTML = node.textContent.replaceAll(emojiRegex, (match, name) => {
      if (emojiUrls[name]) {
        return `<img class="slack-emoji-everywhere" src="${emojiUrls[name]}" alt=":${name}:" title="${name}">`;
      }
      return match;
    });

    node.replaceWith(...newNodeParent.childNodes);
  }
});
