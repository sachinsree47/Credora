@echo off
REM Starts Credora at http://localhost:8000 (Windows)
REM Some installers (PostgreSQL, for example) set these variables to a certificate
REM file that does not exist, which stops pip from downloading packages.
set SSL_CERT_FILE=
set REQUESTS_CA_BUNDLE=
set CURL_CA_BUNDLE=
set PIP_CERT=
cd /d "%~dp0backend"
if not exist .venv ( python -m venv .venv )
call .venv\Scripts\activate
pip install -q -r requirements.txt
if errorlevel 1 (
  echo.
  echo Package install failed. Check your internet connection and try again.
  pause
  exit /b 1
)
echo.
echo Credora is starting. Open http://localhost:8000 in your browser.
uvicorn app.main:app --port 8000
pause
