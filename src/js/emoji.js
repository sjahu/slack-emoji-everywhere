import * as emojiPicker from "./lib/emoji_picker.js";
import * as insertEmoji from "./lib/insert_emoji.js";

// replace all emoji tokens in existing text nodes in the body on document load
insertEmoji.processNodes(
  insertEmoji.getEmojiNodes(document.body)
);

// watching for added/changed text nodes to process later changes to the DOM
new MutationObserver((mutations) => {
  let nodes = mutations.flatMap((mutation) => {
    if (mutation.type == "characterData") {
      return mutation.target;
    } else if (mutation.type == "childList") {
      return [...mutation.addedNodes];
    }
  }).flatMap((node) => insertEmoji.getEmojiNodes(node));

  insertEmoji.processNodes(nodes);
}).observe(
  document.body,
  { subtree: true, childList: true, characterData: true }
);

// set up listeners for emoji picker
window.addEventListener("selectionchange", emojiPicker.handleCaretChange, { capture: true });
window.addEventListener("resize", emojiPicker.handleCaretChange);
document.addEventListener("scroll", emojiPicker.handleCaretChange);
window.addEventListener( // Chrome doesn't appear to fire the selectionchange event when backspacing or deleting
  "input", // and Firefox doesn't fire when deleting
  (e) => {
    if ((e.inputType == "deleteContentBackward" && !globalThis.browser) || e.inputType == "deleteContentForward") {
      emojiPicker.handleCaretChange();
    }
  },
  { capture: true }
);
