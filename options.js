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


browser.permissions.getAll().then((permissions) => {
  let manifest = browser.runtime.getManifest();
  let optional_origins = permissions.origins.filter(
    (origin) => !manifest.permissions.includes(origin) &&
      !manifest.content_scripts.flatMap((content_script) => content_script.matches).includes(origin)
  );

  document.querySelector("#match-patterns").innerHTML = optional_origins.map((origin) => `
    <li>
      <div class="match-pattern"><code>${origin.replace("<all_urls>", "&lt;all_urls&gt;")}</code></div><input type="button" class="match-pattern-delete-button" value="Remove" data-origin="${origin}">
    </li>
  `).join("");

  document.querySelectorAll(".match-pattern-delete-button").forEach((input) => {
    input.addEventListener("click", () => {
      browser.permissions.remove({ origins: [input.dataset.origin] }).then((success) => {
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
