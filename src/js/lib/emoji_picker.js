import { browser } from "./browser_polyfill.js";
import { EMOJI_REGEX } from "./shared_regex.js";

const PARTIAL_EMOJI_REGEX = /:(?<name>[a-z0-9_\-'+]{1,100})/ig;

export function handleCaretChange() {
  let [node, match, callback, x, y] = getBasicInputNode() || getNormalSelectionNode();

  let picker = getPicker();

  if (picker) {
    let parent = node;
    do {
      if (parent == picker) {
        // return if the selection changed because the user clicked on the picker itself
        // this is necessary because otherwise a selection change triggered by the user
        // clicking on the picker might cause the picker to be deleted before the li's
        // click handler can fire
        return;
      }
    } while (parent = parent.parentElement);
  }

  if (!match) {
    picker?.remove();
    return;
  }

  if (picker &&
    picker.emojiPickerNode == node &&
    picker.emojiPickerMatch[0] == match[0] &&
    picker.emojiPickerMatch.index == match.index &&
    picker.emojiPickerMatch.input == match.input
  ) {
    setPickerPosition(picker, x, y); // necessary for resize and scroll events
    return;
  }

  picker ||= makeEmptyPicker();

  picker.emojiPickerNode = node; // save these values before making the async search call
  picker.emojiPickerMatch = match; // so we can avoid duplicating work in case another event
  picker.emojiPickerCallback = callback; // is triggered for the same caret position

  browser.runtime.sendMessage({ type: "searchEmoji", query: match.groups.name }).then((results) => {
    if (results.length) {
      populatePicker(picker, results);
      setPickerPosition(picker, x, y);
    } else {
      picker?.remove();
    }
  });
}

function getBasicInputNode() {
  let node, match, callback, x, y;

  let activeElement = document.activeElement;

  if (activeElement.tagName == "TEXTAREA" || (activeElement.tagName == "INPUT" && activeElement.getAttribute("type") == "text")) {
    node = activeElement;

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

    return [node, match, callback, x, y];
  }
}

function getNormalSelectionNode() {
  let node, match, callback, x, y;

  let range = window.getSelection().getRangeAt(0);
  node = range.endContainer;

  if (node.nodeType == Node.TEXT_NODE && node.parentNode.isContentEditable) {
    if (range.collapsed) {
      match = getPartialEmojiNameAtChar(node.textContent, range.endOffset);
      callback = (emojiName) => {
        let result = insertEmoji(match, emojiName);
        node.textContent = result.str;

        if (!globalThis.browser) { // detect Chrome
          // if the last character in the node is a space, replace it with a non-breaking space
          // otherwise, Chrome ignores it. If you keep typing in the node, the nbsp is replaced
          // with a normal space. very weird.
          // I think this is the same issue: https://github.com/yabwe/medium-editor/issues/1165
          node.textContent = node.textContent.replace(/\u0020$/, "\u00A0");
        }

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
  }

  return [node, match, callback, x, y]; // always returns a node
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

function makeEmptyPicker() {
  let picker = document.createElement("div");
  {
    picker.classList.add("slack-emoji-everywhere-picker", "hidden");
    document.body.append(picker);
  }

  return picker;
}

function populatePicker(picker, emojis) {
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
  picker.classList.remove("hidden");
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
  return {
    str: match.input.substring(0, match.index) + ":" + emojiName + ": " + match.input.substring(match.index + match[0].length).replace(/^:? ?/, ""), // new string
    pos: match.index + emojiName.length + 3 // new caret position (3 chars = 2x ':' chars plus 1x ' ')
  };
}

function setPickerPosition(picker, x, y) {
  picker.style.setProperty("top", `${Math.round(Math.max(0, Math.min(window.innerHeight - picker.clientHeight, y - picker.clientHeight)))}px`);
  picker.style.setProperty("left", `${Math.round(Math.max(0, Math.min(window.innerWidth - picker.clientWidth, x)))}px`);
}
