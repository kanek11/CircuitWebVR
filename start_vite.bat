@echo off

REM 启动 Vite
start npx vite

REM 等待几秒让服务器启动
timeout /t 1 > nul

REM 打开浏览器访问 Vite 服务器
start http://localhost:5173
