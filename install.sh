#!/usr/bin/env sh
set -e

npm install
npm --prefix backend install
npm --prefix frontend install

echo ""
echo "DISPARO WINC instalado."
echo "Execute: npm run dev"
