#Requires -Version 7.0
# SPDX-License-Identifier: Apache-2.0

# Runs PSScriptAnalyzer on the given scripts, including syntax errors and compatibility with
# Windows PowerShell 5.1. Used by lint-powershell.sh inside a container.

param(
    [Parameter(Mandatory)] [string] $AnalyzerVersion,
    [Parameter(Mandatory, ValueFromRemainingArguments)] [string[]] $Path
)

$ErrorActionPreference = 'Stop'
try {
    Import-Module PSScriptAnalyzer -RequiredVersion $AnalyzerVersion
}
catch {
    throw "Could not load PSScriptAnalyzer $AnalyzerVersion. Remove the cache with 'docker volume rm fathom-powershell-modules' and try again. $_"
}

$settings = @{
    IncludeDefaultRules = $true
    Rules               = @{
        PSUseCompatibleSyntax = @{ Enable = $true; TargetVersions = @('5.1', '7.0') }
    }
}

$results = $Path | ForEach-Object {
    Invoke-ScriptAnalyzer -Path $_ -Settings $settings -Severity Warning, Error, ParseError
}
if ($results) {
    $results | Format-Table -AutoSize | Out-String -Width 200 | Write-Output
    exit 1
}
