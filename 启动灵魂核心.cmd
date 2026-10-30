@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missingnode
if exist "%~dp0dist\cli\main.js" goto launch
call npm run build
if errorlevel 1 goto finish
:launch
node "%~dp0dist\cli\main.js" start
goto finish
:missingnode
echo 请先安装 Node.js 24.14 或更新版本。
:finish
pause
