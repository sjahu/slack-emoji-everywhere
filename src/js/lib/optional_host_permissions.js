export function get_user_added_match_patterns() {
  return browser.permissions.getAll().then((permissions) => {
    let manifest = browser.runtime.getManifest();
    return permissions.origins.filter( // return match patterns for all granted permissions except those specifically requested in manifest.json
      (origin) => !manifest.permissions.includes(origin) &&
        !manifest.content_scripts.flatMap((content_script) => content_script.matches).includes(origin)
    );
  });
}
