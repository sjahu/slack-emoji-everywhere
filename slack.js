
// Thanks to https://github.com/jackellenberger/emojme/blob/8c6e2caa1ec5ca66f0be26c424c0e0aeaef6cf4c/README.md#cookie-token-one-liner for the pointer to localConfig_v2
browser.storage.local.get("slackWorkspaceUrl").then(
  (item) => {
    let team = Object.values(
      JSON.parse(localStorage.localConfig_v2 || "{}").teams || {}
    ).find(
      (team) => team.url === item.slackWorkspaceUrl
    );

    if (team) {
      browser.storage.local.set({ slackTeam: team });
    }
  }
);
