@echo off
rem Inicia "Mis Procesos" en este PC. Requiere Node.js (https://nodejs.org, version LTS).
cd /d "%~dp0"
where node >nul 2>nul || (echo Falta instalar Node.js desde https://nodejs.org & pause & exit /b 1)
if "%APP_PASSWORD%"=="" set /p APP_PASSWORD=Clave de la oficina para entrar a la app:
echo.
echo Abra http://localhost:3000 en este PC.
echo En celulares de la misma red Wi-Fi use la direccion IPv4 de este PC, por ejemplo http://192.168.1.20:3000
echo (la puede ver con el comando ipconfig). Cierre esta ventana para detener la app.
echo.
start "" http://localhost:3000
node server.js
pause
