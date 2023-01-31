const path = require('path');

module.exports = {
  entry: {
    background: "./src/js/background.js",
    options: "./src/js/options.js",
    slack: "./src/js/slack.js",
    emoji: "./src/js/emoji.js"
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist")
  },
};
