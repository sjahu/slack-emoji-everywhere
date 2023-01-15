const emojiRegex = /:(?<name>[a-z0-9_\-]{1,100}):/g;

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
    let childNodes = node.textContent.split(emojiRegex).map((substring, i) => {
      // When split is called with a regex containing a capture group, the capture group
      // values are spliced into the array. Annoying, but we can work with it...
      if (i % 2) { // odd substrings are emoji matches
        if (emojiUrls[substring]) {
          let imgElement = document.createElement("img");
          imgElement.setAttribute("class", "slack-emoji-everywhere");
          imgElement.setAttribute("src", emojiUrls[substring]);
          imgElement.setAttribute("title", substring);
          imgElement.setAttribute("alt", `:${substring}:`);

          return imgElement;
        } else {
          return document.createTextNode(`:${substring}:`);
        }
      } else { // even substrings are normal text
        return document.createTextNode(substring);
      }
    });

    node.replaceWith(...childNodes);
    node.normalize();
  }
});
