const EMOJI_REGEX = /:(?<name>[a-z0-9_\-'+]{1,100}):/g;
const PARTIAL_EMOJI_REGEX = /:(?<name>[a-z0-9_\-'+]{1,100})/g;

// CSS selector to match all elements that we'll inject emoji into
// this is a curated subset of all the elements listed on https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const ALLOWED_PARENTS = "body,address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,main,nav,section,blockquote,dd,div,dl,dt,figcaption,figure,li,menu,ol,p,ul,a,abbr,b,bdi,bdo,cite,data,dfn,em,i,mark,q,s,span,strong,sub,sup,time,time,u,var,noscript,del,ins,caption,td,th,buttton,fieldset,form,label,legend,output,details,dialog,summary";

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

function processNodes(nodes) {
  let emojiNames = new Set();

  for (const node of nodes) {
    for (match of node.textContent.matchAll(EMOJI_REGEX)) {
      emojiNames.add(match.groups.name);
    }
  }

  if (emojiNames.size) {
    // TODO: chunk emoji listing API calls
    //       there doesn't appear to be a limit on the number of emojis per call, but there's a 10 000 byte limit on the size of the request body
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

window.addEventListener("selectionchange", handleCaretChange, { capture: true });
window.addEventListener("resize", handleCaretChange);
document.addEventListener("scroll", handleCaretChange);

function handleCaretChange() {
  let range = window.getSelection().getRangeAt(0);
  let node = range.endContainer;

  let existingPicker = getPicker();

  if (existingPicker) {
    let parent = node;
    do {
      if (parent == existingPicker) {
        return; // return if the selection changed because the user clicked on the picker
      }
    } while (parent = parent.parentElement);
  }

  let match, callback, x, y;

  if (node.nodeType == Node.TEXT_NODE && node.parentNode.isContentEditable) {
    if (range.collapsed) {
      match = getPartialEmojiNameAtChar(node.textContent, range.endOffset);
      callback = (emojiName) => {
        let result = insertEmoji(match, emojiName);
        node.textContent = result.str;
        let newSelection = window.getSelection();
        let newRange = document.createRange();
        newRange.setStart(node, result.pos);
        newRange.setEnd(node, result.pos);
        newSelection.removeAllRanges();
        newSelection.addRange(newRange);
      };
      let rect = range.getClientRects()[0];
      x = rect.x;
      y = rect.y;
    }
  } else if (
    node.nodeType == Node.ELEMENT_NODE &&
    (
      node.nodeName == "TEXTAREA" ||
      (node.nodeName == "INPUT" && node.getAttribute("type") == "text")
    )
  ) {
    if (node.selectionEnd == node.selectionStart) {
      match = getPartialEmojiNameAtChar(node.value, node.selectionEnd);
      callback = (emojiName) => {
        let result = insertEmoji(match, emojiName);
        node.value = result.str;
        node.focus();
        node.selectionStart = result.pos;
        node.selectionEnd = result.pos;
      };

      let rect = node.getBoundingClientRect();
      x = rect.x + rect.width; // TODO: you can't get an exact x,y caret position from a textarea or input but apparently
      y = rect.y; // you can create an identically styled invisible div and get the caret position from that element
    }
  }

  if (!match) {
    existingPicker?.remove();
  }

  if (existingPicker &&
    existingPicker.emojiPickerNode == node &&
    existingPicker.emojiPickerMatch[0] == match[0] &&
    existingPicker.emojiPickerMatch.index == match.index &&
    existingPicker.emojiPickerMatch.input == match.input
  ) {
    setPickerPosition(existingPicker, x, y);
    return;
  }

  browser.runtime.sendMessage({ type: "searchEmoji", query: match.groups.name }).then((results) => {
    if (results.length) {
      let picker = makeEmojiPicker(results, node, match, callback);
      setPickerPosition(picker, x, y);
    } else {
      existingPicker?.remove();
    }
  });
}

function getPartialEmojiNameAtChar(str, pos) {
  let completeEmojiMatches = [...str.matchAll(EMOJI_REGEX)];
  let partialEmojiMatches = [...str.matchAll(PARTIAL_EMOJI_REGEX)];

  let newEmojiMatch = partialEmojiMatches.find((partialMatch) =>
    pos > partialMatch.index && pos <= partialMatch.index + partialMatch[0].length // caret is in a partial match
    && !completeEmojiMatches.find((completeMatch) => // partial match doesn't begin with the end of a complete match
      partialMatch.index == completeMatch.index + completeMatch[0].length - 1
    )
  );

  return newEmojiMatch;
}

function makeEmojiPicker(emojis, node, match, callback) {
  let picker = getPicker() || document.createElement("div");
  {
    picker.emojiPickerNode = node;
    picker.emojiPickerMatch = match;
    picker.emojiPickerCallback = callback;

    picker.setAttribute("class", "slack-emoji-everywhere-picker");

    let div = picker.querySelector("div") || document.createElement("div");
    {
      let ul = document.createElement("ul");
      {
        ul.append(...emojis.map((emoji) => {
          let li = document.createElement("li");
          {
            li.setAttribute("data-name", emoji.name);

            let img = document.createElement("img");
            {
              img.setAttribute("src", emoji.value);
              img.setAttribute("class", "slack-emoji-everywhere");
            }

            let span = document.createElement("span");
            {
              span.append(":\u200B", emoji.name, "\u200B:"); // zero-width space chars so we don't emojify these labels
            }

            li.append(img, span);

            li.addEventListener("click", (e) => {
              e.preventDefault();
              picker.emojiPickerCallback(li.getAttribute("data-name"));
              picker.remove();
            });

            li.addEventListener("mouseenter", (e) => {
              li.parentNode.childNodes.forEach((node) => node.removeAttribute("selected"));
              li.setAttribute("selected", "");
            })
          }
          return li;
        }));

        ul.children[0]?.setAttribute("selected", "");
      }
      div.replaceChildren(ul);
    }

    picker.replaceChildren(div);
  }

  document.body.append(picker);

  return picker;
}

window.addEventListener("keydown", (e) => {
  let picker = getPicker();
  let li = picker?.querySelector("li[selected]");

  if (li) {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        picker.remove();
        break;
      case "Enter":
      case "Tab":
        e.preventDefault();
        e.stopPropagation();
        picker.emojiPickerCallback(li.getAttribute("data-name"));
        picker.remove();
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        li.removeAttribute("selected");

        li = li.previousSibling || li.parentNode.children[li.parentNode.children.length - 1];

        li.setAttribute("selected", "");
        if (li.offsetTop < picker.scrollTop || !li.nextSibling) {
          li.scrollIntoView(true); // true=align to top of view
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        li.removeAttribute("selected");

        li = li.nextSibling || li.parentNode.children[0];

        li.setAttribute("selected", "");
        if (li.offsetTop + li.offsetHeight > picker.scrollTop + picker.offsetHeight || !li.previousSibling) {
          li.scrollIntoView(false); // false=align to bottom of view
        }
        break;
    }
  }
}, { capture: true });

function getPicker() {
  return document.querySelector("body .slack-emoji-everywhere-picker");
}

function insertEmoji(match, emojiName) {
  let endColonExists = match.input[match.index + match[0].length] == ":";
  let endSpaceExists = match.input[match.index + match[0].length] == " " || match.input[match.index + match[0].length + 1] == " ";

  return {
    str: match.input.substring(0, match.index) + ":" + emojiName + (endColonExists ? "" : ":") + match.input.substring(match.index + match[0].length) + (endSpaceExists ? "" : " "), // new string
    pos: match.index + emojiName.length + 3 // new caret position (3 chars = 2x ':' chars plus 1x ' ')
  };
}

function setPickerPosition(picker, x, y) {
  picker.style.setProperty("top", `${Math.round(Math.max(0, Math.min(window.innerHeight - picker.clientHeight, y - picker.clientHeight)))}px`);
  picker.style.setProperty("left", `${Math.round(Math.max(0, Math.min(window.innerWidth - picker.clientWidth, x)))}px`);
}
