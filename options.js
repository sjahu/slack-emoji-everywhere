browser.storage.local.get({ slackWorkspaceUrl: "" }).then((item) => {
  document.querySelector("#slack-workspace-url").value = item.slackWorkspaceUrl;
});

document.querySelector("#options-form").addEventListener("submit", () => {
  browser.storage.local.set({ slackWorkspaceUrl: document.querySelector("#slack-workspace-url").value });
});
