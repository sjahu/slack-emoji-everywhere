import { get_user_added_match_patterns } from "./optional_host_permissions.js";
import * as emojiCache from "./emoji_url_cache.js";

browser.storage.local.get(["slackConfig", "selectedTeamId"]).then((item) => {
  if (item.slackConfig) {
    let teams = Object.values(item.slackConfig.teams).sort((a, b) => a.name.localeCompare(b.name));
    if (teams.length) {
      document.querySelector("#workspace-inputs").innerHTML = `
        <ul>${teams.map((team) => `
          <li>
            <input type="radio"
                  name="workspace"
                  id="${team.id}"
                  value="${team.id}"
                  ${team.id === item.selectedTeamId ? 'checked' : ''}
            >
            <label for="${team.id}">
              <img class="workspace-image" src="${team.icon.image_68}">
              ${team.name}
              <span class="team-url">${team.url}</span>
            </label>
          </li>
        `).join("")}</ul>
      `;
      document.querySelectorAll("input[name='workspace']").forEach((input) => input.addEventListener("change", () => {
        browser.storage.local.set({ selectedTeamId: input.value });
        browser.runtime.reload();
      }));
    }
  }
});

get_user_added_match_patterns().then((patterns) => {
  document.querySelector("#match-patterns").innerHTML = patterns.map((pattern) => `
    <li>
      <div class="match-pattern"><code>${pattern.replace("<all_urls>", "&lt;all_urls&gt;")}</code></div><input type="button" class="match-pattern-delete-button" value="Remove" data-pattern="${pattern}">
    </li>
  `).join("");

  document.querySelectorAll(".match-pattern-delete-button").forEach((input) => {
    input.addEventListener("click", () => {
      browser.permissions.remove({ origins: [input.dataset.pattern] }).then((success) => {
        if (success) {
          browser.runtime.reload();
        }
      });
    })
  });
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

emojiCache.count().then((count) => document.querySelector("#emoji-cache-count").textContent = count);

document.querySelector("#clear-cache-button").addEventListener("click", () => {
  emojiCache.clear();
  browser.runtime.reload();
});
