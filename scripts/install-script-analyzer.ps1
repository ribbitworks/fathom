#Requires -Version 7.0
# Installs a pinned PSScriptAnalyzer version into a module folder after checking the package's hash.
# Used by lint-powershell.sh inside a container. The install is complete only when its marker file
# records the expected hash, so an interrupted install is replaced on the next run.
param(
    [Parameter(Mandatory)] [string] $Version,
    [Parameter(Mandatory)] [string] $Sha256,
    [Parameter(Mandatory)] [string] $ModulesPath
)

$ErrorActionPreference = 'Stop'

$target = Join-Path $ModulesPath "PSScriptAnalyzer/$Version"
$marker = Join-Path $target '.fathom-sha256'
$manifest = Join-Path $target 'PSScriptAnalyzer.psd1'
if ((Test-Path $marker) -and (Test-Path $manifest) -and ((Get-Content $marker -Raw).Trim() -eq $Sha256)) { exit 0 }

$package = Join-Path ([IO.Path]::GetTempPath()) "psscriptanalyzer.$Version.zip"
Invoke-WebRequest -Uri "https://www.powershellgallery.com/api/v2/package/psscriptanalyzer/$Version" -OutFile $package -MaximumRetryCount 4 -RetryIntervalSec 5
$actual = (Get-FileHash -Algorithm SHA256 -Path $package).Hash
if ($actual -ne $Sha256) {
    throw "PSScriptAnalyzer $Version has hash $actual, but $Sha256 was expected"
}

$partial = "$target.partial"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $partial, $target
Expand-Archive -Path $package -DestinationPath $partial
Set-Content -Path (Join-Path $partial '.fathom-sha256') -Value $Sha256
Move-Item -Path $partial -Destination $target
