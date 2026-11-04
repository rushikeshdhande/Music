// plugins/withActivityLabel.js
// Keeps the launcher icon label as "Music" while the app name
// (used in the notification header) stays "Apple Music".
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = (config, label = "Music") =>
  withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    const main = app.activity.find(
      (a) => a.$["android:name"] === ".MainActivity"
    );
    if (main) main.$["android:label"] = label;
    return cfg;
  });