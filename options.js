import { get_user_added_match_patterns } from "./optional_host_permissions.js";
import * as emojiCache from "./emoji_url_cache.js";

browser.storage.local.get(["slackConfig", "selectedTeamId"]).then((item) => {
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
          input.addEventListener("change", () => {
            browser.storage.local.set({ selectedTeamId: input.value });
            browser.runtime.reload();
          });

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
            code.textContent = pattern.replace("<all_urls>", "&lt;all_urls&gt;");
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
                browser.runtime.reload();
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
        browser.runtime.reload();
      }
    });
  } catch (error) {
    alert("Invalid match pattern 😭\n\nSee https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns");
  }
});

document.querySelector("#match-pattern-input").addEventListener("keyup", (e) => {
  if (e.key == "Enter") {
    document.querySelector("#match-pattern-add-button").click()
  }
});

emojiCache.count().then((count) => document.querySelector("#emoji-cache-count").textContent = count);

document.querySelector("#clear-cache-button").addEventListener("click", () => {
  emojiCache.clear();
  browser.runtime.reload();
});
