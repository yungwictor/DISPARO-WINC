$ErrorActionPreference = "Stop"

npm install
npm --prefix backend install
npm --prefix frontend install

Write-Host ""
Write-Host "DISPARO WINC instalado."
Write-Host "Execute: npm run dev"
