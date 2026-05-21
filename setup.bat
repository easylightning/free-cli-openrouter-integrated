@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ================================================
echo   openrouter-free-cli - Kurulum
echo  ================================================
echo.

:: ── Node.js kontrolü ─────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [HATA] Node.js bulunamadi.
    echo  Lutfen https://nodejs.org adresinden indirin.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  [OK] Node.js %%v

:: ── Bağımlılıklar ────────────────────────────────
echo.
echo  [*] Bagimliliklar yukleniyor...
npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo.
    echo  [HATA] npm install basarisiz.
    pause
    exit /b 1
)
echo  [OK] Bagimliliklar yuklendi.

:: ── Build ─────────────────────────────────────────
echo.
echo  [*] Derleniyor...
npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [HATA] Build basarisiz. Yukaridaki hataya bakin.
    pause
    exit /b 1
)
echo  [OK] Build tamamlandi.

:: ── Global link ───────────────────────────────────
echo.
echo  [*] Global komut olarak ekleniyor...
npm link --no-audit --no-fund
if %errorlevel% neq 0 (
    echo  [UYARI] Global link basarisiz.
    echo  Direkt calistirmak icin: node dist/index.js
) else (
    echo  [OK] Global link tamamlandi.
)

echo.
echo  ================================================
echo   Kurulum tamamlandi!
echo   Kullanim: openrouter-free
echo  ================================================
echo.
pause
