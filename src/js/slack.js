// Copy Slack's config to the extension's local storage so the other extension scripts can read it
browser.storage.local.set({ slackConfig: JSON.parse(localStorage.localConfig_v2) });

// Default the selected workspace to the active one
browser.storage.local.get("selectedTeamId").then((item) => {
  if (!item.selectedTeamId) {
    browser.storage.local.set({ selectedTeamId: JSON.parse(localStorage.localConfig_v2).lastActiveTeamId });
  }
});
