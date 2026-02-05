@echo off
REM Initialize git repo and create initial commit (current codebase)
cd /d "%~dp0"

if exist .git (
  echo Git repo already exists.
  git status
  exit /b 0
)

echo Initializing git repository...
git init

echo Adding all files...
git add .

echo Creating initial commit...
git commit -m "Initial commit: TvX IPTV Tauri app (before movie playback fix)"

echo Done.
git log -1 --oneline
