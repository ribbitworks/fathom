#Requires -Version 5.1
# SPDX-License-Identifier: Apache-2.0

<#
.SYNOPSIS
Prepares a Windows development machine for Fathom. Safe to run repeatedly.

.PARAMETER ConfigureShell
Also adds fnm to your PowerShell profile for all hosts, such as the terminal and VS Code, so
Node.js switches automatically. Windows PowerShell 5.1 and PowerShell 7 keep separate profiles, so
run this in each edition you use.

.NOTES
Not yet run on Windows; checked only with PSScriptAnalyzer.
If PowerShell blocks scripts, allow local scripts for your account first:
    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#>

[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingInvokeExpression', '', Justification = 'fnm emits its environment setup as PowerShell code, which must be evaluated.')]
param(
    [switch] $ConfigureShell
)

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

    $fnmLine = 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
    $profilePath = $PROFILE.CurrentUserAllHosts
    $knownProfiles = @($profilePath, $PROFILE.CurrentUserCurrentHost) | Where-Object { Test-Path $_ }
    $alreadyConfigured = $knownProfiles -and (Select-String -Path $knownProfiles -SimpleMatch 'fnm env' -Quiet)
    $editionName = if ($PSVersionTable.PSEdition -eq 'Core') { 'PowerShell' } else { 'Windows PowerShell' }
    if (-not $alreadyConfigured) {
        if ($ConfigureShell) {
            Write-Step "Adding fnm to the $editionName $($PSVersionTable.PSVersion) profile at $profilePath"
            if (-not (Test-Path $profilePath)) {
                # -Force here creates the profile's folder too; it is never used on an existing profile.
                New-Item -ItemType File -Force -Path $profilePath | Out-Null
            }
            Add-Content -Path $profilePath -Value "`n# fnm: switch Node.js versions automatically per project`n$fnmLine"
        }
        else {
            Write-Step "To switch Node.js automatically in this folder, add this line to $profilePath,"
            Write-Step 'or run this script again with -ConfigureShell:'
            Write-Step "    $fnmLine"
        }
    }

    Write-Step 'Done'
}
finally {
    Pop-Location
}
