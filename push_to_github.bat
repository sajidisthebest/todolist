@echo off
echo ==========================================
echo Pushing TaskFlow Pro to GitHub: sajidisthebest/todolist
echo ==========================================
git init
git add .
git commit -m "Launch TaskFlow Pro: Modern Task Studio & Admin Suite"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/sajidisthebest/todolist.git
git push -u origin main
echo ==========================================
echo Done! If prompted, sign in to your GitHub account.
pause
