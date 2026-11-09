@echo off
chcp 65001 > nul
set NODE_EXE="C:\Users\mabou.DESKTOP-LEOA8QH\.gemini\antigravity\node-portable\node-v22.11.0-win-x64\node.exe"

if not exist %NODE_EXE% (
    set NODE_EXE=node
)

echo [動くナンプレ (NumPre Shift)] サーバーを起動しています...
cd /d "%~dp0"
start http://localhost:3000/
%NODE_EXE% server.js
pause
