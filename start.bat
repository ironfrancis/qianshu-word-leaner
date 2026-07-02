@echo off
chcp 65001 >nul
echo ====================================
echo   英语单词打字练习程序
echo   正在启动本地服务器...
echo ====================================
echo.
echo 服务器地址: http://localhost:8000
echo 请在浏览器中打开以上地址
echo.
echo 按 Ctrl+C 停止服务器
echo ====================================
echo.

cd /d "%~dp0"
python -m http.server 8000

pause
