const emojiRegex = /:(?<name>[a-z0-9_\-'+]{1,100}):/g;
const partialEmojiRegex = /:(?<name>[a-z0-9_\-'+]{1,100})/g;

// CSS selector to match all elements that we'll inject emoji into
// this is a curated subset of all the elements listed on https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const allowedParents = "body,address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,main,nav,section,blockquote,dd,div,dl,dt,figcaption,figure,li,menu,ol,p,ul,a,abbr,b,bdi,bdo,cite,data,dfn,em,i,mark,q,s,span,strong,sub,sup,time,time,u,var,noscript,del,ins,caption,td,th,buttton,fieldset,form,label,legend,output,details,dialog,summary"

processNodes(getEmojiNodes(document.body)); // process all existing text nodes in the body on load

new MutationObserver((mutations) => { // process later changes to the DOM by watching for added/changed text nodes
  let nodes = mutations.flatMap((mutation) => {
    if (mutation.type == "characterData") {
      return mutation.target;
    } else if (mutation.type == "childList") {
      return [...mutation.addedNodes];
    }
  }).flatMap((node) => getEmojiNodes(node));

  processNodes(nodes);
}).observe(
  document.body,
  { subtree: true, childList: true, characterData: true }
);

function getEmojiNodes(root) {
  let nodeIterator = document.createNodeIterator(
    root,
    NodeFilter.SHOW_TEXT, // only consider text nodes
    (node) =>
      node.textContent.match(emojiRegex) &&
        node.parentElement.matches(allowedParents) &&
        !node.parentNode.isContentEditable
        ?
        NodeFilter.FILTER_ACCEPT
        :
        NodeFilter.FILTER_REJECT
  );

  let nodes = [];
  let node;
  while (node = nodeIterator.nextNode()) {
    nodes.push(node);
  }

  return nodes;
}

function processNodes(nodes) {
  let emojiNames = new Set();

  for (const node of nodes) {
    for (match of node.textContent.matchAll(emojiRegex)) {
      emojiNames.add(match.groups.name);
    }
  }

  if (emojiNames.size) {
    // TODO: chunk emoji listing API calls
    //       there doesn't appear to be a limit on the number of emojis per call, but there's a 10 000 byte limit on the size of the request body
    browser.runtime.sendMessage({ type: "getEmoji", emojiNames: [...emojiNames] }).then((emojiUrls) => {
      for (const node of nodes) {
        if (![...node.textContent.matchAll(emojiRegex)].filter((match) => emojiUrls[match.groups.name]).length) {
          continue; // skip child node replacement if none of the emoji actually exist
        }

        let childNodes = node.textContent.split(emojiRegex).map((substring, i) => {
          // When split is called with a regex containing a capture group, the capture group
          // values are spliced into the array. Annoying, but we can work with it...
          if (i % 2) { // odd substrings are emoji matches
            let name = substring;

            if (emojiUrls[name]) {
              let imgElement = document.createElement("img");
              imgElement.setAttribute("class", "slack-emoji-everywhere");
              imgElement.setAttribute("src", emojiUrls[name]);
              imgElement.setAttribute("title", name);
              imgElement.setAttribute("alt", `:${name}:`);

              return imgElement;
            } else {
              return document.createTextNode(`:${name}:`);
            }
          } else { // even substrings are normal text
            return document.createTextNode(substring);
          }
        });

        let parentNode = node.parentNode;
        node.replaceWith(...childNodes);
        parentNode.normalize(); // combine adjacent text nodes
      }
    });
  }
}

window.addEventListener("input", (e) => {
  let range = window.getSelection().getRangeAt(0);
  let node = range.endContainer;

  let query;

  if (node.nodeType == Node.TEXT_NODE) {
    if (range.collapsed) {
      query = getPartialEmojiNameAtChar(node.textContent, range.endOffset);
    }
  } else {
    if (node.selectionEnd == node.selectionStart) {
      query = getPartialEmojiNameAtChar(node.value, node.selectionEnd);
    }
  }

  if (query) {
    browser.runtime.sendMessage({ type: "searchEmoji", query: query }).then((results) => console.log(results));
  }
});

function getPartialEmojiNameAtChar(str, pos) {
  let completeEmojiMatches = [...str.matchAll(emojiRegex)];
  let partialEmojiMatches = [...str.matchAll(partialEmojiRegex)];

  let newEmojiMatch = partialEmojiMatches.find((partialMatch) =>
    pos > partialMatch.index && pos <= partialMatch.index + partialMatch[0].length // caret is in a partial match
    && !completeEmojiMatches.find((completeMatch) => // partial match doesn't begin with the end of a complete match
      partialMatch.index == completeMatch.index + completeMatch[0].length - 1
    )
  );

  return newEmojiMatch?.groups.name;
}
