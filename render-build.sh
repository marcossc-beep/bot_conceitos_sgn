#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
# Força o download do Chrome para o cache do Puppeteer
npx puppeteer browsers install chrome