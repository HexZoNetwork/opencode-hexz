@echo off
setlocal enabledelayedexpansion

set "FORCE=false"
set "TARGET=all"

:parse_args
if "%~1"=="" goto :parse_done
if "%~1"=="-f" set "FORCE=true" & shift & goto :parse_args
if "%~1"=="--force" set "FORCE=true" & shift & goto :parse_args
if "%~1"=="-g" set "TARGET=global" & shift & goto :parse_args
if "%~1"=="--global" set "TARGET=global" & shift & goto :parse_args
if "%~1"=="-p" set "TARGET=project" & shift & goto :parse_args
if "%~1"=="--project" set "TARGET=project" & shift & goto :parse_args
if "%~1"=="-h" goto :usage
if "%~1"=="--help" goto :usage
echo Unknown: %1
goto :usage

:parse_done
echo.
echo   HEXZ Uninstall
echo.

set "REMOVED=0"

if "%TARGET%"=="all" (
  call :remove_project
  call :remove_global
)
if "%TARGET%"=="project" call :remove_project
if "%TARGET%"=="global" call :remove_global

echo.
if "%REMOVED%"=="1" (
  echo   HEXZ removed. Restart opencode.
) else (
  echo   Nothing to remove.
)
echo.
goto :eof

:usage
echo HEXZ Uninstall
echo.
echo Usage:
echo   uninstall.bat [OPTIONS]
echo.
echo Options:
echo   -f, --force    Remove without confirmation
echo   -g, --global   Remove global install only
echo   -p, --project  Remove project install only
echo   -h, --help     Show this help
echo.
goto :eof

:remove_project
set "dir=.opencode"
set "found=0"

if exist "%dir%\plugins\hexz\index.ts" set "found=1"
if exist "%dir%\plugins\hexz\index.js" set "found=1"
if exist "%dir%\plugins\hexz.js" set "found=1"
if exist "%dir%\plugins\hexz.ts" set "found=1"

if "%found%"=="0" (
  echo   No project install found
  goto :eof
)

if "%FORCE%"=="false" (
  set /p "CONFIRM=  Remove project files from %dir%/? [y/N]: "
  if /i not "!CONFIRM!"=="y" (
    echo   Skipped
    goto :eof
  )
)

if exist "%dir%\plugins\hexz" rmdir /s /q "%dir%\plugins\hexz"
if exist "%dir%\plugins\package.json" del "%dir%\plugins\package.json"
if exist "%dir%\plugins\index.ts" del "%dir%\plugins\index.ts"
if exist "%dir%\plugins\hexz.js" del "%dir%\plugins\hexz.js"
if exist "%dir%\plugins\hexz.ts" del "%dir%\plugins\hexz.ts"
if exist "%dir%\commands\active.md" del "%dir%\commands\active.md"
if exist "%dir%\commands\off.md" del "%dir%\commands\off.md"

rd "%dir%\commands" 2>nul
rd "%dir%" 2>nul

call :remove_plugin_from_config "%CD%"
echo [OK] Removed project install
set "REMOVED=1"
goto :eof

:remove_global
set "dir=%USERPROFILE%\.config\opencode"
set "found=0"

if exist "%dir%\plugins\hexz\index.ts" set "found=1"
if exist "%dir%\plugins\hexz\index.js" set "found=1"
if exist "%dir%\plugins\hexz.js" set "found=1"
if exist "%dir%\plugins\hexz.ts" set "found=1"

if "%found%"=="0" (
  echo   No global install found
  goto :eof
)

if "%FORCE%"=="false" (
  set /p "CONFIRM=  Remove global files from %dir%/? [y/N]: "
  if /i not "!CONFIRM!"=="y" (
    echo   Skipped
    goto :eof
  )
)

if exist "%dir%\plugins\hexz" rmdir /s /q "%dir%\plugins\hexz"
if exist "%dir%\plugins\package.json" del "%dir%\plugins\package.json"
if exist "%dir%\plugins\index.ts" del "%dir%\plugins\index.ts"
if exist "%dir%\plugins\hexz.js" del "%dir%\plugins\hexz.js"
if exist "%dir%\plugins\hexz.ts" del "%dir%\plugins\hexz.ts"
if exist "%dir%\commands\active.md" del "%dir%\commands\active.md"
if exist "%dir%\commands\off.md" del "%dir%\commands\off.md"

rd "%dir%\commands" 2>nul
rd "%dir%\plugins" 2>nul

call :remove_plugin_from_config "%USERPROFILE%\.config\opencode"
echo [OK] Removed global install
set "REMOVED=1"
goto :eof

:remove_plugin_from_config
set "dir=%~1"
set "config_file="

if exist "%dir%\opencode.json" set "config_file=%dir%\opencode.json"
if exist "%dir%\opencode.jsonc" set "config_file=%dir%\opencode.jsonc"
if "%config_file%"=="" goto :eof

set "plugin_path=./.opencode/plugins"
if /i "%dir%"=="%USERPROFILE%\.config\opencode" set "plugin_path=~/.config/opencode/plugins"

powershell -NoProfile -Command ^
  $configFile = '%config_file:\=\\%'; ^
  $pluginPath = '%plugin_path:\=\\%'; ^
  try { ^
    $raw = Get-Content $configFile -Raw; ^
    $config = $raw ^| ConvertFrom-Json; ^
    if (-not $config.plugin) { exit 0 }; ^
    $before = @($config.plugin).Count; ^
    $config.plugin = @($config.plugin ^| Where-Object { ^
      $_ -ne $pluginPath -and $_ -notmatch 'hexz' -and $_ -notmatch 'opencode-hexz' ^
    }); ^
    if (@($config.plugin).Count -eq $before) { exit 0 }; ^
    if (@($config.plugin).Count -eq 0) { ^
      $config.PSObject.Properties.Remove('plugin'); ^
    }; ^
    $config ^| ConvertTo-Json -Depth 10 ^| Set-Content $configFile; ^
    Write-Host "removed"; ^
  } catch { exit 0 }

for /f %%i in ('powershell -NoProfile -Command "'removed'"') do set "PS_OUT=%%i"
if "!PS_OUT!"=="removed" (
  for %%f in ("%config_file%") do echo [OK] Removed plugin from %%~nxf
)
goto :eof
