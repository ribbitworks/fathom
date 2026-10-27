#Requires -Version 5.1
<#
.SYNOPSIS
Prepares a Windows development machine for Fathom. Safe to run repeatedly.

.NOTES
Not yet run on Windows; checked only with PSScriptAnalyzer.
If PowerShell blocks scripts, allow local scripts for your account first:
    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#>
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingInvokeExpression', '', Justification = 'fnm emits its environment setup as PowerShell code, which must be evaluated.')]
param()

$ErrorActionPreference = 'Stop'

function Write-Step([string] $Message) {
    Write-Information "==> $Message" -InformationAction Continue
}

function Assert-ExitCode([string] $Action) {
    if ($LASTEXITCODE -ne 0) { throw "$Action failed with exit code $LASTEXITCODE" }
}

Push-Location (Join-Path $PSScriptRoot '..')
try {
    $nodeVersion = (Get-Content '.node-version' -Raw).Trim()
    $pnpmVersion = ((Get-Content 'package.json' -Raw | ConvertFrom-Json).packageManager -replace '^pnpm@', '') -replace '\+.*$', ''
    if (-not $pnpmVersion) { throw 'Could not read the pnpm version from package.json' }

    if (-not (Get-Command fnm -ErrorAction SilentlyContinue)) {
        if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
            throw 'winget is required to install fnm. Install winget, or install fnm (https://github.com/Schniz/fnm), then run this again.'
        }
        Write-Step 'Installing fnm'
        winget install --exact --id Schniz.fnm --accept-source-agreements --accept-package-agreements
        Assert-ExitCode 'Installing fnm'
        $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        $env:Path = "$machinePath;$userPath"
    }
    fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression

    Write-Step "Using Node.js $nodeVersion"
    fnm use --install-if-missing $nodeVersion | Out-Null
    Assert-ExitCode "Installing Node.js $nodeVersion"

    $installedPnpm = if (Get-Command pnpm -ErrorAction SilentlyContinue) { (pnpm --version) } else { '' }
    if ($installedPnpm -ne $pnpmVersion) {
        Write-Step "Installing pnpm $pnpmVersion"
        npm install --global --ignore-scripts "pnpm@$pnpmVersion" | Out-Null
        Assert-ExitCode "Installing pnpm $pnpmVersion"
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'A container runtime is required; see docs/operations/supported-platforms.md'
    }
    # Windows PowerShell 5.1 turns a native command's error output into a terminating error under
    # 'Stop', so the check runs under 'Continue' to report a clear message instead.
    $ErrorActionPreference = 'Continue'
    docker info *> $null
    $dockerExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($dockerExitCode -ne 0) { throw 'The container runtime is installed but not running' }

    Write-Step 'Installing dependencies'
    pnpm install
    Assert-ExitCode 'Installing dependencies'

    if (-not (Test-Path $PROFILE) -or -not (Select-String -Path $PROFILE -SimpleMatch 'fnm env' -Quiet)) {
        Write-Step "Add this line to $PROFILE so Node.js switches automatically in this folder:"
        Write-Step '    fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
    }

    Write-Step 'Done'
}
finally {
    Pop-Location
}
