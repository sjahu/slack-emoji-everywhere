import { browser } from "./lib/browser_polyfill.js";
import { get_user_added_match_patterns } from "./lib/optional_host_permissions.js";
import * as emojiCache from "./lib/emoji_url_cache.js";
import { registerContentScripts } from "./lib/register_content_scripts.js";

browser.storage.local.get(["slackConfig", "selectedTeamId", "customApiUrl", "customApiToken"]).then((item) => {
  if (item.slackConfig) {
    let teams = Object.values(item.slackConfig.teams).sort((a, b) => a.name.localeCompare(b.name));
    if (teams.length) {
      let ul = document.createElement("ul");
      ul.append(...teams.map((team) => {
        let li = document.createElement("li");
        {
          let input = document.createElement("input");
          input.setAttribute("type", "radio");
          input.setAttribute("name", "workspace");
          input.setAttribute("id", team.id);
          input.setAttribute("value", team.id);
          if (team.id === item.selectedTeamId) {
            input.setAttribute("checked", "");
          }

          let label = document.createElement("label");
          {
            label.setAttribute("for", team.id);

            let img = document.createElement("img");
            {
              img.setAttribute("class", "workspace-image");
              img.setAttribute("src", team.icon.image_68);
            }

            let spanTeamName = document.createElement("span");
            {
              spanTeamName.setAttribute("class", "team-name");
              spanTeamName.textContent = team.name;
            }

            let spanTeamUrl = document.createElement("span");
            {
              spanTeamUrl.setAttribute("class", "team-url");
              spanTeamUrl.textContent = team.url;
            }

            label.append(img, spanTeamName, spanTeamUrl);
          }

          li.append(input, label);
        }
        return li;
      }));
      document.querySelector("#workspace-inputs").replaceChildren(ul);
    }
  }

  if ("slack-emoji-everywhere-custom" === item.selectedTeamId) {
    document.querySelector("#slack-emoji-everywhere-custom").setAttribute("checked", "");
  }
  document.querySelector("#custom-api-url").value = item.customApiUrl || "";
  document.querySelector("#custom-api-token").value = item.customApiToken || "";
  document.querySelector("#custom-api-save-button").addEventListener("click", () => {
    browser.storage.local.set({
      customApiUrl: document.querySelector("#custom-api-url").value,
      customApiToken: document.querySelector("#custom-api-token").value,
    });
  });

  document.querySelectorAll("input[name='workspace']").forEach((input) => {
    input.addEventListener("change", () => {
      browser.storage.local.set({ selectedTeamId: input.value }).then(() => window.location.reload());
    });
  });
});

get_user_added_match_patterns().then((patterns) => {
  if (patterns.length) {
    let ul = document.createElement("ul");
    ul.append(...patterns.map((pattern) => {
      let li = document.createElement("li");
      {
        let div = document.createElement("div");
        {
          div.setAttribute("class", "match-pattern");

          let code = document.createElement("code");
          {
            code.textContent = pattern;
          }

          div.append(code);
        }

        let input = document.createElement("input");
        {
          input.setAttribute("type", "button");
          input.setAttribute("class", "match-pattern-delete-button");
          input.setAttribute("value", "Remove");
          input.setAttribute("data-pattern", pattern);

          input.addEventListener("click", () => {
            browser.permissions.remove({ origins: [input.dataset.pattern] }).then((success) => {
              if (success) {
                registerContentScripts().then(() => window.location.reload());
              }
            });
          });
        }

        li.append(div, input);
      }
      return li;
    }));
    document.querySelector("#match-patterns").replaceChildren(ul);
  }
});

document.querySelector("#match-pattern-add-button").addEventListener("click", () => {
  try {
    browser.permissions.request({ origins: [document.querySelector("#match-pattern-input").value] }).then((success) => {
      if (success) {
        document.querySelector("#match-pattern-input").value = "";
        registerContentScripts().then(() => window.location.reload());
      }
    });
  } catch (error) {
    alert("Invalid match pattern ????\n\nSee https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns");
  }
});

document.querySelector("#match-pattern-input").addEventListener("keyup", (e) => {
  if (e.key == "Enter") {
    document.querySelector("#match-pattern-add-button").click()
  }
});

emojiCache.count().then((count) => document.querySelector("#emoji-cache-count").textContent = count);

document.querySelector("#clear-cache-button").addEventListener("click", () => {
  emojiCache.clear().then(() => window.location.reload());
});

document.querySelector("#slack-link").addEventListener("click", () => {
  // In manifest v3, we need to explicitly get permission for these origins
  // This might be a Firefox bug?
  browser.permissions.request({ origins: ["https://app.slack.com/*", "https://edgeapi.slack.com/*"] }).then((success) => {
    if (success) {
      browser.tabs.create({ url: "https://app.slack.com/client" });
    }
  });
});
