@echo off
echo ===============================================================
echo   Transfer Detail Dashboard - Update ^& Deploy
echo ===============================================================
echo.
echo  Folder: %~dp0
echo  (Edit TransferDetail.csv and AgencyMap.csv in this folder)
echo.

echo [1/3] Compiling data.json from CSV files...
node "%~dp0process_data.js"
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Data compilation failed! Check that TransferDetail.csv
    echo        and AgencyMap.csv exist in this folder and try again.
    pause
    exit /b 1
)

echo.
echo [2/3] Staging changes...
cd /d "%~dp0"
git add data.json process_data.js app.js index.html index.css update.bat README.md hobo.jpg

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