#!/bin/bash

echo
echo "Generating js bundles..."
npx webpack --mode none # production


echo
echo "Packaging Firefox extension..."
mkdir -p build/firefox
cp dist/*.js src/html/*.html src/css/*.css build/firefox
cp manifest_firefox.json build/firefox/manifest.json

rm -f slack-emoji-everywhere.xpi

if command -v zip > /dev/null; then
  zip -j build/slack-emoji-everywhere.xpi build/firefox/*
else
  echo "zip not found, install it to package the extension for Firefox"
fi


echo
echo "Packaging Chrome extension..."
mkdir -p build/chrome
cp dist/*.js src/html/*.html src/css/*.css build/chrome
cp manifest_chrome.json build/chrome/manifest.json

if command -v chrome > /dev/null; then
  CHROME=chrome
elif command -v chromium > /dev/null; then
  CHROME=chromium
fi

if [ -v CHROME ]; then
  $CHROME --pack-extension=build/chrome
  rm build/chrome.pem # we don't care about this keyfile for now
  mv build/chrome.crx build/slack-emoji-everywhere.crx
else
  echo "chrome/chromium not found, install it to package the extension for Chrome"
fi
