#!/bin/bash

npx webpack --mode production

cp src/manifest.json src/html/*.html src/css/*.css dist/
zip -j slack-emoji-everywhere.xpi dist/*
