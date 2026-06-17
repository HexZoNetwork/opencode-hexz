@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "MODE="
set "AUTO_YES=false"
set "DEST="

:parse_args
if "%~1"=="" goto :parse_done
if "%~1"=="-g" set "MODE=global" & shift & goto :parse_args
if "%~1"=="--global" set "MODE=global" & shift & goto :parse_args
if "%~1"=="-p" set "MODE=project" & shift & goto :parse_args
if "%~1"=="--project" set "MODE=project" & shift & goto :parse_args
if "%~1"=="-b" set "MODE=both" & shift & goto :parse_args
if "%~1"=="--both" set "MODE=both" & shift & goto :parse_args
if "%~1"=="-y" set "AUTO_YES=true" & shift & goto :parse_args
if "%~1"=="--yes" set "AUTO_YES=true" & shift & goto :parse_args
if "%~1"=="-h" goto :usage
if "%~1"=="--help" goto :usage
if "%~1"=="-v" goto :version
if "%~1"=="--version" goto :version
echo Unknown flag: %1
goto :usage

:parse_done
if "%DEST%"=="" set "DEST=."

echo.
echo   +-------------------------+
echo   ^|     HEXZ - OpenCode     ^|
echo   +-------------------------+
echo.

:preflight_bun
where bun >nul 2>nul
if %errorlevel% equ 0 (
  for /f "tokens=*" %%i in ('bun --version 2^>nul') do set "BUN_VER=%%i"
  echo [OK] bun !BUN_VER!
  goto :preflight_git
)
echo [WARN] bun not found. Installing via PowerShell...
powershell -NoProfile -Command "& { iwr https://bun.sh/install.ps1 -UseBasicParsing | iex }"
if %errorlevel% neq 0 (
  echo [FAIL] bun installation failed.
  echo   Install manually: https://bun.sh
  exit /b 1
)

:bun_check_installed
set "BUN_INSTALL=%USERPROFILE%\.bun"
set "PATH=%BUN_INSTALL%\bin;%BUN_INSTALL%;%PATH%"
where bun >nul 2>nul
if %errorlevel% neq 0 (
  echo [FAIL] bun installation failed.
  echo   Restart your shell.
  exit /b 1
)
for /f "tokens=*" %%i in ('bun --version 2^>nul') do set "BUN_VER=%%i"
echo [OK] bun !BUN_VER! installed

:preflight_git
where git >nul 2>nul
if %errorlevel% equ 0 (
  for /f "tokens=3" %%i in ('git --version 2^>nul') do set "GIT_VER=%%i"
  echo [OK] git !GIT_VER!
  goto :preflight_node
)
echo [WARN] git not found. Some features need git.

:preflight_node
where node >nul 2>nul
if %errorlevel% equ 0 (
  for /f "tokens=*" %%i in ('node --version 2^>nul') do set "NODE_VER=%%i"
echo   [OK] node !NODE_VER!
  goto :preflight_puppeteer
)
echo   node not found (optional)

:preflight_puppeteer
where chromium >nul 2>nul
if %errorlevel% equ 0 (
  echo [OK] Chromium found for Puppeteer
  goto :build_plugin
)
echo [WARN] Chromium not found. hexz_webss requires it.
echo   Install manually or let Puppeteer download it during npm install.

:build_plugin
echo.
echo Building plugin...
if not exist "%SCRIPT_DIR%\package.json" (
  echo [FAIL] package.json not found in %SCRIPT_DIR%
  exit /b 1
)

bun install --cwd "%SCRIPT_DIR%" --frozen-lockfile 2>nul
if %errorlevel% neq 0 (
  echo   Lockfile mismatch, running bun install...
  bun install --cwd "%SCRIPT_DIR%"
  if !errorlevel! neq 0 (
    echo [FAIL] bun install failed
    exit /b 1
  )
)

bun run --cwd "%SCRIPT_DIR%" build
if %errorlevel% neq 0 (
  echo [FAIL] Build failed. Check: bun run typecheck
  exit /b 1
)

if not exist "%SCRIPT_DIR%\dist\hexz.js" (
  echo [FAIL] dist/hexz.js not found after build
  exit /b 1
)

for %%i in ("%SCRIPT_DIR%\dist\hexz.js") do set "SIZE=%%~zi"
echo [OK] Build complete (!SIZE! bytes)
echo.

:choose_mode
if not "%MODE%"=="" goto :do_install
if "%AUTO_YES%"=="true" set "MODE=project" & goto :do_install
echo Install target:
echo   1) Project-level   -> ./.opencode/
echo   2) Global           -> %%USERPROFILE%%\.config\opencode\
echo   3) Both
echo.
set /p "CHOICE=  Choose [1-3] (default: 1): "
if "%CHOICE%"=="" set "CHOICE=1"
if "%CHOICE%"=="1" set "MODE=project"
if "%CHOICE%"=="2" set "MODE=global"
if "%CHOICE%"=="3" set "MODE=both"
if "%MODE%"=="" echo Invalid choice. & exit /b 1

:do_install
echo Installing:

if "%MODE%"=="project" call :install_to "%CD%\.opencode" "Project-level"
if "%MODE%"=="global" call :install_to "%USERPROFILE%\.config\opencode" "Global"
if "%MODE%"=="both" (
  call :install_to "%USERPROFILE%\.config\opencode" "Global"
  echo.
  call :install_to "%CD%\.opencode" "Project-level"
)

echo.
echo Verifying config:
if "%MODE%"=="project" call :verify_config "%CD%"
if "%MODE%"=="global" call :verify_config "%USERPROFILE%\.config\opencode"
if "%MODE%"=="both" (
  call :verify_config "%CD%"
  call :verify_config "%USERPROFILE%\.config\opencode"
)

echo.
echo   HEXZ installed successfully!
echo.
echo   Next steps:
echo     1. Restart opencode (if running)
echo     2. Type /active to engage HEXZ
echo     3. Type /off to revert
echo.
echo   Tools:
echo     hexz_search    Search the web
echo     hexz_scan      Security audit
echo     hexz_design    Design scaffolds
echo     hexz_image     Image analysis (OCR)
echo     hexz_webss     Web screenshots (Puppeteer)
echo     hexz_mcp       MCP server management
echo     hexz_memory    Persistent agent memory
echo     hexz_pr        Git PR workflow
echo     hexz_mkp       Plugin marketplace
echo.
echo   https://github.com/hexzonetwork/opencode-hexz
echo.
goto :eof

:usage
echo HEXZ - OpenCode Upgrade Layer
echo.
echo Usage:
echo   install.bat [OPTIONS] [DIRECTORY]
echo.
echo Options:
echo   -g, --global     Install to %%USERPROFILE%%\.config\opencode\ only
echo   -p, --project    Install to .\.opencode\ only (default)
echo   -b, --both       Install globally and locally
echo   -y, --yes        Accept all defaults, no prompts
echo   -h, --help       Show this help
echo   -v, --version    Show plugin version
echo.
echo Examples:
echo   install.bat
echo   install.bat -g
echo   install.bat C:\my\project -y
echo   install.bat -b
echo.
goto :eof

:version
for /f "tokens=*" %%i in ('type "%SCRIPT_DIR%\package.json" ^| findstr "version"') do echo %%i
goto :eof

:install_to
set "dest=%~1"
set "label=%~2"
set "plugdir=%dest%\plugins"
set "hexzdir=%plugdir%\hexz"

if not exist "%hexzdir%" mkdir "%hexzdir%"
if not exist "%dest%\commands" mkdir "%dest%\commands"

copy "%SCRIPT_DIR%\dist\hexz.js" "%hexzdir%\index.js" >nul
copy "%SCRIPT_DIR%\src\hexz.ts" "%hexzdir%\index.ts" >nul
  if exist "%SCRIPT_DIR%\src\design" (
    xcopy /E /I /Y "%SCRIPT_DIR%\src\design" "%hexzdir%\design" >nul
  )
  if exist "%SCRIPT_DIR%\src\cybersecurity" (
    xcopy /E /I /Y "%SCRIPT_DIR%\src\cybersecurity" "%hexzdir%\cybersecurity" >nul
  )

(
echo {
echo   "type": "module"
echo }
) > "%hexzdir%\package.json"

(
echo {
echo   "name": "opencode-hexz",
echo   "version": "1.4.0",
echo   "description": "HEXZ - OpenCode Upgrade Layer",
echo   "type": "module",
echo   "main": "index.ts",
echo   "dependencies": {
echo     "@opencode-ai/plugin": "latest"
echo   }
echo }
) > "%plugdir%\package.json"

> "%plugdir%\index.ts" echo let initialized = false;
>> "%plugdir%\index.ts" echo let hooks: any = null;
>> "%plugdir%\index.ts" echo.
>> "%plugdir%\index.ts" echo const init = async (input: any^) =^> {
>> "%plugdir%\index.ts" echo   if (initialized^) return hooks ^|^| {};
>> "%plugdir%\index.ts" echo   initialized = true;
>> "%plugdir%\index.ts" echo   const mod = await import^("./hexz/index.ts"^);
>> "%plugdir%\index.ts" echo   const fn = mod.default ^|^| mod.HexzPlugin ^|^| mod;
>> "%plugdir%\index.ts" echo   if ^(typeof fn === "function"^) hooks = ^(await fn^(input^)^)^) ^|^| {};
>> "%plugdir%\index.ts" echo   else hooks = {};
>> "%plugdir%\index.ts" echo   return hooks;
>> "%plugdir%\index.ts" echo };
>> "%plugdir%\index.ts" echo.
>> "%plugdir%\index.ts" echo const HexzPlugin: any = (input: any^) =^> init(input^);
>> "%plugdir%\index.ts" echo export default HexzPlugin;
>> "%plugdir%\index.ts" echo export const server = HexzPlugin;

> "%dest%\commands\active.md" echo ---
>> "%dest%\commands\active.md" echo description: Engage HEXZ upgrade layer ^(anti-slop, security, design, search, marketplace^)
>> "%dest%\commands\active.md" echo ---
>> "%dest%\commands\active.md" echo HEXZ_ACTIVATE

> "%dest%\commands\off.md" echo ---
>> "%dest%\commands\off.md" echo description: Revert to default opencode behavior
>> "%dest%\commands\off.md" echo ---
>> "%dest%\commands\off.md" echo HEXZ_DEACTIVATE

> "%dest%\commands\models.md" echo ---
>> "%dest%\commands\models.md" echo description: Open HEXZ model routing TUI. Configure per-task model routing.
>> "%dest%\commands\models.md" echo ---
>> "%dest%\commands\models.md" echo HEXZ_MODELS

echo [OK] %label%
echo     plugins\hexz\index.ts   -^> %hexzdir%\index.ts
echo     plugins\hexz\index.js   -^> %hexzdir%\index.js
echo     plugins\hexz\design\    -^> %hexzdir%\design\
echo     plugins\hexz\cybersecurity\ -^> %hexzdir%\cybersecurity\
echo     plugins\package.json    -^> %plugdir%\package.json
echo     plugins\index.ts        -^> %plugdir%\index.ts
echo     commands\active.md      -^> %dest%\commands\active.md
echo     commands\off.md         -^> %dest%\commands\off.md
goto :eof

:verify_config
set "dir=%~1"
set "found_config="

if exist "%dir%\opencode.json" set "found_config=%dir%\opencode.json"
if exist "%dir%\opencode.jsonc" set "found_config=%dir%\opencode.jsonc"

if "%found_config%"=="" (
  set "new_plugin_path=./.opencode/plugins"
  if /i "%dir%"=="%USERPROFILE%\.config\opencode" set "new_plugin_path=~/.config/opencode/plugins"
  (
  echo {
  echo   "$schema": "https://opencode.ai/config.json",
  echo   "plugin": ["!new_plugin_path!"]
  echo }
  ) > "%dir%\opencode.json"
  echo [OK] Created opencode.json
  goto :eof
)

:: Use PowerShell to check and update JSON config
set "plugin_path=./.opencode/plugins"
if /i "%dir%"=="%USERPROFILE%\.config\opencode" set "plugin_path=~/.config/opencode/plugins"

powershell -NoProfile -Command ^
  $configFile = '%found_config:\=\\%'; ^
  $pluginPath = '%plugin_path:\=\\%'; ^
  try { ^
    $raw = Get-Content $configFile -Raw; ^
    $config = $raw ^| ConvertFrom-Json; ^
    if ($config.plugin -and @($config.plugin).Contains($pluginPath)) { ^
      exit 0; ^
    } ^
    if ($config.plugin) { ^
      $arr = @($config.plugin) + @($pluginPath); ^
      $config.plugin = $arr; ^
    } else { ^
      $config ^| Add-Member -Force -MemberType NoteProperty -Name 'plugin' -Value @($pluginPath); ^
    } ^
    $config ^| ConvertTo-Json -Depth 10 ^| Set-Content $configFile; ^
    Write-Host "added"; ^
  } catch { exit 1 }
if %errorlevel% equ 0 (
  for /f %%i in ('powershell -NoProfile -Command "'added'"') do set "PS_OUT=%%i"
  if "!PS_OUT!"=="added" echo [OK] Added hexz to opencode.json
) else (
  echo [WARN] Could not update opencode.json
)
goto :eof
