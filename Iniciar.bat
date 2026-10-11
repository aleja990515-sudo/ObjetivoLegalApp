@echo off
rem Inicia "Mis Procesos" en este PC. Requiere Node.js (https://nodejs.org, version LTS),
rem el archivo .env (copiado de .env.example con DATABASE_URL y APP_PASSWORD) y la base de datos
rem PostgreSQL activa (npm run db:up).
cd /d "%~dp0"
where node >nul 2>nul || (echo Falta instalar Node.js desde https://nodejs.org & pause & exit /b 1)
if not exist ".env" if "%DATABASE_URL%"=="" (echo Falta el archivo .env. Copie .env.example a .env y complete DATABASE_URL y APP_PASSWORD. & pause & exit /b 1)
if not exist "apps\api\dist\main.js" (
echo Compilando la API...
call npm run build:api
if errorlevel 1 (pause & exit /b 1)
)
echo.
echo Abra http://localhost:3000 en este PC.
echo En celulares de la misma red Wi-Fi use la direccion IPv4 de este PC, por ejemplo http://192.168.1.20:3000
echo (la puede ver con el comando ipconfig). Cierre esta ventana para detener la app.
echo.
start "" http://localhost:3000
call npm start
pause
