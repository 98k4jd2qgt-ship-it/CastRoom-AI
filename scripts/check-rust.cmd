@echo off
setlocal

set "VCVARS=%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if not exist "%VCVARS%" (
  echo Missing Visual Studio Build Tools vcvars64.bat
  exit /b 1
)

call "%VCVARS%" > nul
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
cargo check --manifest-path src-tauri/Cargo.toml

