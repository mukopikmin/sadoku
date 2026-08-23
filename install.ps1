[CmdletBinding()]
param(
    [switch]$Nightly
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repository = "https://github.com/mukopikmin/sadoku"
$target = "windows-x64"
$temporaryDirectory = $null

function Stop-Installer([string]$Message) {
    throw "sadoku installer: $Message"
}

try {
    if (-not [Environment]::Is64BitOperatingSystem) {
        Stop-Installer "Windows x64 is required."
    }
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        Stop-Installer "LOCALAPPDATA is not set."
    }
    $installDirectory = Join-Path $env:LOCALAPPDATA "Programs\sadoku"

    if ($Nightly) {
        $tag = "nightly"
    } else {
        try {
            $latest = Invoke-WebRequest -Uri "$repository/releases/latest" -UseBasicParsing
            if ($latest.BaseResponse.RequestMessage) {
                $releaseUrl = $latest.BaseResponse.RequestMessage.RequestUri.AbsoluteUri
            } else {
                $releaseUrl = $latest.BaseResponse.ResponseUri.AbsoluteUri
            }
            $tag = $releaseUrl.TrimEnd("/").Split("/")[-1]
        } catch {
            Stop-Installer "could not resolve the latest release."
        }
    }

    if ($tag -ne "nightly" -and $tag -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$') {
        Stop-Installer "invalid release tag: $tag"
    }

    $version = if ($tag -eq "nightly") { "nightly" } else { $tag.Substring(1) }
    $archiveRoot = if ($tag -eq "nightly") {
        "sadoku-nightly-$target"
    } else {
        "sadoku-v$version-$target"
    }
    $archive = "$archiveRoot.zip"
    $downloadUrl = "$repository/releases/download/$tag"
    $temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("sadoku-install-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    $archivePath = Join-Path $temporaryDirectory $archive
    $checksumPath = "$archivePath.sha256"

    Write-Host "Downloading sadoku $version for $target..."
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "$downloadUrl/$archive" -OutFile $archivePath
        Invoke-WebRequest -UseBasicParsing -Uri "$downloadUrl/$archive.sha256" -OutFile $checksumPath
    } catch {
        Stop-Installer "could not download $archive and its checksum."
    }

    $expectedChecksum = (Get-Content -Raw $checksumPath).Trim()
    if ($expectedChecksum -notmatch '^[0-9a-fA-F]{64}$') {
        Stop-Installer "invalid SHA-256 checksum."
    }
    $actualChecksum = (Get-FileHash -Algorithm SHA256 $archivePath).Hash
    if ($actualChecksum -ne $expectedChecksum) {
        Stop-Installer "SHA-256 checksum mismatch."
    }

    Expand-Archive -LiteralPath $archivePath -DestinationPath $temporaryDirectory
    $binaryPath = Join-Path $temporaryDirectory "$archiveRoot\sadoku.exe"
    if (-not (Test-Path -LiteralPath $binaryPath -PathType Leaf)) {
        Stop-Installer "release archive does not contain sadoku.exe."
    }

    New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
    $stagedBinary = Join-Path $installDirectory (".sadoku-" + [guid]::NewGuid() + ".exe")
    Copy-Item -LiteralPath $binaryPath -Destination $stagedBinary
    Move-Item -LiteralPath $stagedBinary -Destination (Join-Path $installDirectory "sadoku.exe") -Force

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $pathEntries = @($userPath -split ';' | Where-Object { $_ })
    if ($pathEntries -notcontains $installDirectory) {
        $newPath = (@($pathEntries) + $installDirectory) -join ';'
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Host "Added $installDirectory to your user PATH. Open a new terminal to use sadoku."
    }

    Write-Host "Installed sadoku $version to $installDirectory\sadoku.exe"
} catch {
    Write-Error $_.Exception.Message
    exit 1
} finally {
    if ($temporaryDirectory -and (Test-Path -LiteralPath $temporaryDirectory)) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}
