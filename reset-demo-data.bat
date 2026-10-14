@echo off
setlocal
title Smart Dispatch - reset demo data
cd /d "%~dp0backend"

echo.
echo  Resets the LOCAL database to the same demo data as the online demo (Render/Vercel):
echo  14 markets with photos, deals, promo codes, a month of orders and reviews.
echo  Demo logins (password 123456): admin@test.com, owner@test.com, driver@test.com, customer@test.com
echo.
echo  Your current local data will be replaced. A backup copy is saved first.
echo.
choice /c YN /m "Continue"
if errorlevel 2 goto :eof

for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "STAMP=%%t"
if exist "database\database.sqlite" (
  copy /y "database\database.sqlite" "database\database.backup-%STAMP%.sqlite" >nul
  echo  Backup: backend\database\database.backup-%STAMP%.sqlite
) else (
  type nul > "database\database.sqlite"
)

rem Same steps as backend/docker/start.sh on the online demo.
call php artisan migrate:fresh --force || goto failed
call php artisan db:seed --force || goto failed
call php artisan tinker --execute="app(App\Http\Controllers\Api\DemoScenarioController::class)->store();"
call php artisan db:seed --class=DemoCatalogSeeder --force || goto failed
call php artisan storage:link >nul 2>&1

echo.
echo  Done. Refresh the web page / reload the app.
echo.
pause
goto :eof

:failed
echo.
echo  Something went wrong - see the messages above. Your backup is in backend\database\.
echo.
pause
