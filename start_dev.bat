@echo off
title TDConnect - Lanceur de serveurs de développement
echo =======================================================
echo     Demarrage des serveurs de developpement TDConnect   
echo =======================================================
echo.

:: Se deplacer dans le repertoire du projet
cd /d "%~dp0"

echo [1/2] Lancement du serveur API (Backend sur le port 3000)...
start "TDConnect - Backend" cmd /k "node server/index.cjs"

echo Attente de 5 secondes pour l'initialisation de la base de donnees et du serveur API...
timeout /t 5 /nobreak >nul

echo [2/2] Lancement du serveur de developpement (Frontend sur le port 5173)...
start "TDConnect - Frontend" cmd /k "npm run dev"

echo.
echo =======================================================
echo   Les deux serveurs ont ete lances dans des fenetres   
echo   separees. Vous pouvez fermer cette console.          
echo =======================================================
echo.
pause
