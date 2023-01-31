const path = require('path');

module.exports = {
  entry: {
    background: "./src/js/background.js",
    options: "./src/js/options.js",
    slack: "./src/js/slack.js",
    "not-slack": "./src/js/not-slack.js"
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist")
  },
};
