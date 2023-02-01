// Firefox and Safari use the proposed standard namespace, "browser", while
// Chromium and its descendents use "chrome".
//
// With manifest v3, chrome added support for promise-based APIs so something like
// https://github.com/mozilla/webextension-polyfill is no longer necessary to avoid
// having to use use the old-fashioned callback-based methods for these APIs.
export const browser = globalThis.browser || globalThis.chrome;
