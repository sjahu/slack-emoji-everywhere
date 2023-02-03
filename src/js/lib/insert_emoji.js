import { browser } from "./browser_polyfill.js";
import { EMOJI_REGEX } from "./shared_regex.js";

// CSS selector to match all elements that we'll inject emoji into
// this is a curated subset of all the elements listed on https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const ALLOWED_PARENTS = "body,address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,main,nav,section,blockquote,dd,div,dl,dt,figcaption,figure,li,menu,ol,p,ul,a,abbr,b,bdi,bdo,cite,data,dfn,em,i,mark,q,s,span,strong,sub,sup,time,time,u,var,noscript,del,ins,caption,td,th,buttton,fieldset,form,label,legend,output,details,dialog,summary";

export function getEmojiNodes(root) {
  let nodeIterator = document.createNodeIterator(
    root,
    NodeFilter.SHOW_TEXT, // only consider text nodes
    (node) =>
      node.textContent.match(EMOJI_REGEX) &&
        node.parentElement.matches(ALLOWED_PARENTS) &&
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

export function processNodes(nodes) {
  let emojiNames = new Set();

  for (const node of nodes) {
    for (const match of node.textContent.matchAll(EMOJI_REGEX)) {
      emojiNames.add(match.groups.name);
    }
  }

  if (emojiNames.size) {
    browser.runtime.sendMessage({ type: "getEmoji", emojiNames: [...emojiNames] }).then((emojiUrls) => {
      for (const node of nodes) {
        if (![...node.textContent.matchAll(EMOJI_REGEX)].filter((match) => emojiUrls[match.groups.name]).length) {
          continue; // skip child node replacement if none of the emoji actually exist
        }

        let childNodes = node.textContent.split(EMOJI_REGEX).map((substring, i) => {
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
