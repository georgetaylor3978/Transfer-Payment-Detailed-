@echo off
echo ===============================================================
echo   Transfer Detail Dashboard - Update ^& Deploy
echo ===============================================================
echo.
echo  Data folder:      C:\Users\kroon\.gemini\antigravity\playground\TransferDetail
echo  Dashboard folder: %~dp0
echo.

echo [1/3] Compiling data.json from CSV files...
node "%~dp0process_data.js"
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Data compilation failed! Check that TransferDetail.csv
    echo        exists in your data folder and try again.
    pause
    exit /b 1
)

echo.
echo [2/3] Staging changes...
cd /d "%~dp0"
git add -A

echo.
echo [3/3] Committing and pushing to GitHub...
for /f "tokens=*" %%i in ('date /t') do set DATESTAMP=%%i
for /f "tokens=*" %%i in ('time /t') do set TIMESTAMP=%%i
git commit -m "Quarterly data refresh: %DATESTAMP% %TIMESTAMP%"
git push origin main

echo.
echo ===============================================================
echo   Done! GitHub Pages will update in ~1-2 minutes.
echo   https://georgetaylor3978.github.io/Transfer-Payment-Detailed-/
echo ===============================================================
pause