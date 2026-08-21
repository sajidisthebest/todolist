@echo off
set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"
echo ==========================================
echo Pushing Updates to GitHub: sajidisthebest/todolist
echo ==========================================
git add .
git commit -m "Update TaskFlow Pro" 2>nul
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/sajidisthebest/todolist.git
echo.
echo Uploading changes to GitHub...
git push -u origin main
echo.
echo ==========================================
echo Push complete! Netlify/Vercel will auto-deploy.
echo ==========================================
pause
