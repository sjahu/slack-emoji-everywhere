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
