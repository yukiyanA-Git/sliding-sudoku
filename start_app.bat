@echo off
title NumPre Shift (Sliding Sudoku)
cd /d "%~dp0"
set NODE_EXE=%USERPROFILE%\.gemini\antigravity\node-portable\node-v22.11.0-win-x64\node.exe
if not exist "%NODE_EXE%" (
    set NODE_EXE=node
)
echo ========================================================
echo   動くナンプレ『NumPre Shift』ローカル開発サーバー起動中...
echo ========================================================
start "" http://localhost:3000
"%NODE_EXE%" server.js
pause
