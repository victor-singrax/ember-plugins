@echo off
if not exist "%~dp0.runtime\phoenix.dll" (
    echo Build the Ember runtime first with scripts\build-runtime.ps1.
    exit /b 1
)
if not exist "%~dp0.runtime\phoenix-inject.exe" (
    echo Build the Ember runtime first with scripts\build-runtime.ps1.
    exit /b 1
)
"%~dp0.runtime\phoenix-inject.exe" "%~dp0.runtime\phoenix.dll"
