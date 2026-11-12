[CmdletBinding()]
param(
    [string]$OutputPath = "",
    [switch]$IncludeMedia,
    [ValidateRange(1, 1024)]
    [int]$MaxFileSizeMB = 8
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDirectory "..")).Path

function Convert-ToFullPath {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [Parameter(Mandatory)]
        [string]$BasePath
    )

    if ([IO.Path]::IsPathRooted($Path)) {
        return [IO.Path]::GetFullPath($Path)
    }

    return [IO.Path]::GetFullPath((Join-Path $BasePath $Path))
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $outputFullPath = Join-Path $projectRoot "AI-exports\legend-eternal-ai-package.zip"
} else {
    # 相對路徑固定以專案根目錄為基準，避免從不同工作目錄執行時輸出到意外位置。
    $outputFullPath = Convert-ToFullPath -Path $OutputPath -BasePath $projectRoot
}

$requiredProjectPaths = @(
    "VERSION",
    "index.html",
    "src",
    "tools"
)

$missingProjectPaths = @(
    $requiredProjectPaths | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $projectRoot $_))
    }
)

if ($missingProjectPaths.Count -gt 0) {
    throw "專案根目錄驗證失敗，缺少：$($missingProjectPaths -join ', ')"
}

$alwaysExcludedDirectoryNames = @(
    ".git",
    ".agents",
    ".codex",
    ".idea",
    ".vscode",
    "node_modules",
    "__pycache__",
    "AI-exports",
    "coverage",
    "dist"
)

$mediaDirectoryPrefixes = @(
    "assets"
)

$sourceExtensions = @(
    ".bat", ".cmd", ".css", ".csv", ".html", ".ini", ".js", ".jsx", ".json",
    ".md", ".mjs", ".ps1", ".py", ".scss", ".sh", ".toml", ".ts", ".tsx",
    ".txt", ".xml", ".yaml", ".yml"
)

$mediaExtensions = @(
    ".aac", ".avi", ".avif", ".bmp", ".flac", ".gif", ".ico", ".jpeg", ".jpg",
    ".m4a", ".mkv", ".mov", ".mp3", ".mp4", ".ogg", ".opus", ".png", ".svg",
    ".tif", ".tiff", ".wav", ".webm", ".webp"
)

$archiveExtensions = @(
    ".7z", ".gz", ".rar", ".tar", ".tgz", ".zip"
)

$allowedExtensionlessNames = @(
    ".editorconfig",
    ".gitattributes",
    ".gitignore",
    "Dockerfile",
    "LICENSE",
    "VERSION"
)

$sensitiveExtensions = @(
    ".key", ".p12", ".pem", ".pfx"
)

function Get-RelativePathString {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    # 使用 URI 計算相對路徑，兼容 Windows PowerShell 5.1 與 PowerShell 7。
    $trimChars = [char[]]@(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    )
    $basePath = $projectRoot.TrimEnd($trimChars) + [IO.Path]::DirectorySeparatorChar
    $baseUri = [Uri]$basePath
    $targetUri = [Uri]([IO.Path]::GetFullPath($Path))
    $relativePath = [Uri]::UnescapeDataString(
        $baseUri.MakeRelativeUri($targetUri).ToString()
    )

    return $relativePath.Replace("\", "/")
}

function Test-PathPrefix {
    param(
        [Parameter(Mandatory)]
        [string]$RelativePath,

        [Parameter(Mandatory)]
        [string]$Prefix
    )

    return $RelativePath.Equals($Prefix, [StringComparison]::OrdinalIgnoreCase) -or
        $RelativePath.StartsWith("$Prefix/", [StringComparison]::OrdinalIgnoreCase)
}

function Get-ExclusionReason {
    param(
        [Parameter(Mandatory)]
        [IO.FileInfo]$File
    )

    $fileFullPath = [IO.Path]::GetFullPath($File.FullName)
    if ($fileFullPath.Equals($outputFullPath, [StringComparison]::OrdinalIgnoreCase)) {
        return "output-file"
    }

    if (($File.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        return "reparse-point"
    }

    $relativePath = Get-RelativePathString -Path $File.FullName
    $segments = $relativePath.Split("/", [StringSplitOptions]::RemoveEmptyEntries)

    if ($segments | Where-Object { $alwaysExcludedDirectoryNames -contains $_ }) {
        return "excluded-directory"
    }

    if (-not $IncludeMedia) {
        if ($mediaDirectoryPrefixes | Where-Object {
            Test-PathPrefix -RelativePath $relativePath -Prefix $_
        }) {
            return "media-directory"
        }
    }

    $name = $File.Name
    $extension = $File.Extension.ToLowerInvariant()

    $isEnvFile = $name -match '^\.env(?:\..+)?$'
    $isEnvTemplate = $name -match '^\.env\.(?:example|sample|template)$'
    if (($isEnvFile -and -not $isEnvTemplate) -or
        $name -in @(".npmrc", ".pypirc", "credentials.json", "secrets.json") -or
        $sensitiveExtensions -contains $extension) {
        return "sensitive-file"
    }

    if ($archiveExtensions -contains $extension) {
        return "archive-file"
    }

    if ($File.Length -gt ($MaxFileSizeMB * 1MB)) {
        return "oversized-file"
    }

    if ($sourceExtensions -contains $extension) {
        return $null
    }

    if ($IncludeMedia -and $mediaExtensions -contains $extension) {
        return $null
    }

    if ([string]::IsNullOrEmpty($extension) -and $allowedExtensionlessNames -contains $name) {
        return $null
    }

    return "unsupported-file-type"
}

$outputDirectory = Split-Path -Parent $outputFullPath
if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) (
    "legend-eternal-ai-package-" + [guid]::NewGuid().ToString("N")
)
$tempZipPath = Join-Path $outputDirectory (
    ".legend-eternal-ai-package-" + [guid]::NewGuid().ToString("N") + ".zip"
)

New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

$includedFiles = [Collections.Generic.List[IO.FileInfo]]::new()
$includedRelativePaths = [Collections.Generic.List[string]]::new()
$skippedEntries = [Collections.Generic.List[string]]::new()

try {
    $allFiles = Get-ChildItem -LiteralPath $projectRoot -File -Recurse -Force |
        Sort-Object FullName

    foreach ($file in $allFiles) {
        $relativePath = Get-RelativePathString -Path $file.FullName
        $reason = Get-ExclusionReason -File $file

        if ($null -ne $reason) {
            $skippedEntries.Add("$reason`t$relativePath")
            continue
        }

        $includedFiles.Add($file)
        $includedRelativePaths.Add($relativePath)

        $destination = Join-Path $stagingRoot $relativePath
        $destinationDirectory = Split-Path -Parent $destination

        if (-not [string]::IsNullOrWhiteSpace($destinationDirectory)) {
            New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        }

        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
    }

    $branch = "unavailable"
    $commit = "unavailable"
    $workingTree = "unavailable"

    $gitCommand = Get-Command git -ErrorAction SilentlyContinue
    $gitMetadataPath = Join-Path $projectRoot ".git"

    if ($null -ne $gitCommand -and (Test-Path -LiteralPath $gitMetadataPath)) {
        try {
            $branchOutput = @(& git -C $projectRoot branch --show-current 2>$null)
            if ($LASTEXITCODE -eq 0 -and $branchOutput.Count -gt 0) {
                $branch = ($branchOutput -join "").Trim()
            }

            $commitOutput = @(& git -C $projectRoot rev-parse --short HEAD 2>$null)
            if ($LASTEXITCODE -eq 0 -and $commitOutput.Count -gt 0) {
                $commit = ($commitOutput -join "").Trim()
            }

            $statusLines = @(& git -C $projectRoot status --short 2>$null)
            if ($LASTEXITCODE -eq 0) {
                $workingTree = if ($statusLines.Count -eq 0) {
                    "clean"
                } else {
                    "dirty ($($statusLines.Count) entries)"
                }
            }
        } catch {
            $branch = "unavailable"
            $commit = "unavailable"
            $workingTree = "unavailable"
        }
    }

    $mediaMode = if ($IncludeMedia) { "included" } else { "excluded" }
    $generatedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"

    $manifest = @(
        "Legend Eternal AI source package",
        "Generated: $generatedAt",
        "Source root: $projectRoot",
        "Branch at generation: $branch",
        "Commit at generation: $commit",
        "Working tree at generation: $workingTree",
        "Git metadata inside ZIP: excluded",
        "Assets/media: $mediaMode",
        "Maximum included file size: $MaxFileSizeMB MiB",
        "",
        "IMPORTANT:",
        "- This ZIP is a source-context package for AI review and development.",
        "- It is not a full backup or a restore archive.",
        "- The .git directory is intentionally excluded.",
        "- When media is excluded, the missing assets directory is expected.",
        "- Never use this ZIP as a reason to delete or replace local assets."
    )

    $manifest | Set-Content -LiteralPath (
        Join-Path $stagingRoot "AI_PACKAGE_INFO.txt"
    ) -Encoding UTF8

    Set-Content -LiteralPath (
        Join-Path $stagingRoot "AI_PACKAGE_FILES.txt"
    ) -Value @($includedRelativePaths) -Encoding UTF8

    Set-Content -LiteralPath (
        Join-Path $stagingRoot "AI_PACKAGE_SKIPPED.txt"
    ) -Value @($skippedEntries) -Encoding UTF8

    Add-Type -AssemblyName System.IO.Compression.FileSystem

    if (Test-Path -LiteralPath $tempZipPath) {
        Remove-Item -LiteralPath $tempZipPath -Force
    }

    [IO.Compression.ZipFile]::CreateFromDirectory(
        $stagingRoot,
        $tempZipPath,
        [IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    $archive = [IO.Compression.ZipFile]::OpenRead($tempZipPath)
    try {
        $fileEntries = @($archive.Entries | Where-Object {
            -not [string]::IsNullOrEmpty($_.Name)
        })

        $expectedEntryCount = $includedFiles.Count + 3
        if ($fileEntries.Count -ne $expectedEntryCount) {
            throw "ZIP 驗證失敗：預期 $expectedEntryCount 個檔案，實際 $($fileEntries.Count) 個。"
        }

        $entryNames = @($fileEntries | ForEach-Object {
            $_.FullName.Replace("\", "/")
        })

        foreach ($requiredPath in @(
            "VERSION",
            "index.html",
            "AI_PACKAGE_INFO.txt",
            "AI_PACKAGE_FILES.txt",
            "AI_PACKAGE_SKIPPED.txt"
        )) {
            if ($entryNames -notcontains $requiredPath) {
                throw "ZIP 驗證失敗：缺少必要檔案 $requiredPath"
            }
        }

        if (-not $IncludeMedia -and ($entryNames | Where-Object {
            Test-PathPrefix -RelativePath $_ -Prefix "assets"
        })) {
            throw "ZIP 驗證失敗：媒體排除模式下仍包含 assets。"
        }
    } finally {
        $archive.Dispose()
    }

    if (Test-Path -LiteralPath $outputFullPath) {
        Remove-Item -LiteralPath $outputFullPath -Force
    }

    Move-Item -LiteralPath $tempZipPath -Destination $outputFullPath -Force

    $includedBytes = ($includedFiles | Measure-Object -Property Length -Sum).Sum
    if ($null -eq $includedBytes) {
        $includedBytes = 0
    }

    $zipBytes = (Get-Item -LiteralPath $outputFullPath).Length
    $relativeOutput = Get-RelativePathString -Path $outputFullPath

    Write-Output "OUTPUT=$relativeOutput"
    Write-Output "FILES=$($includedFiles.Count)"
    Write-Output "SKIPPED=$($skippedEntries.Count)"
    Write-Output ("SOURCE_MIB={0:N2}" -f ($includedBytes / 1MB))
    Write-Output ("ZIP_MIB={0:N2}" -f ($zipBytes / 1MB))
    Write-Output "MEDIA_MODE=$mediaMode"
    Write-Output "GIT_BRANCH=$branch"
    Write-Output "GIT_COMMIT=$commit"
    Write-Output "GIT_WORKTREE=$workingTree"
} finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }

    if (Test-Path -LiteralPath $tempZipPath) {
        Remove-Item -LiteralPath $tempZipPath -Force
    }
}
