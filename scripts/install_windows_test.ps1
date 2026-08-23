$ErrorActionPreference = "Stop"

$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("sadoku-windows-install-test-" + [guid]::NewGuid())
$fixtures = Join-Path $testRoot "fixtures"
$localAppData = Join-Path $testRoot "local-app-data"
$archiveRoot = "sadoku-v1.2.3-windows-x64"
$archive = "$archiveRoot.zip"
$originalLocalAppData = $env:LOCALAPPDATA
$originalUserPath = [Environment]::GetEnvironmentVariable("Path", "User")

try {
    New-Item -ItemType Directory -Path (Join-Path $fixtures $archiveRoot) -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $fixtures "$archiveRoot\sadoku.exe") -Value "sadoku 1.2.3"
    Compress-Archive -LiteralPath (Join-Path $fixtures $archiveRoot) -DestinationPath (Join-Path $fixtures $archive)
    (Get-FileHash -Algorithm SHA256 (Join-Path $fixtures $archive)).Hash.ToLowerInvariant() |
        Set-Content -NoNewline -LiteralPath (Join-Path $fixtures "$archive.sha256")

    function Invoke-WebRequest {
        param(
            [string]$Uri,
            [string]$OutFile,
            [switch]$UseBasicParsing
        )

        if (-not $OutFile) {
            return [pscustomobject]@{
                BaseResponse = [pscustomobject]@{
                    RequestMessage = [pscustomobject]@{
                        RequestUri = [uri]"https://github.com/mukopikmin/sadoku/releases/tag/v1.2.3"
                    }
                }
            }
        }

        Copy-Item -LiteralPath (Join-Path $fixtures ([IO.Path]::GetFileName($Uri))) -Destination $OutFile
    }

    $env:LOCALAPPDATA = $localAppData
    . (Join-Path $PSScriptRoot "..\install.ps1")

    $installed = Join-Path $localAppData "Programs\sadoku\sadoku.exe"
    if ((Get-Content -Raw -LiteralPath $installed).Trim() -ne "sadoku 1.2.3") {
        throw "The Windows installer did not install the expected executable."
    }
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if (($userPath -split ';') -notcontains (Split-Path $installed)) {
        throw "The Windows installer did not add its install directory to the user PATH."
    }
} finally {
    $env:LOCALAPPDATA = $originalLocalAppData
    [Environment]::SetEnvironmentVariable("Path", $originalUserPath, "User")
    Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}
