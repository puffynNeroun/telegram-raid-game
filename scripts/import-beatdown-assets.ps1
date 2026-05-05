$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path

$AttackZip = Join-Path $Root "attack_sprites_transparent_split.zip"
$CharactersZip = Join-Path $Root "character_hp_sprites_split.zip"

if (!(Test-Path $AttackZip)) {
    throw "Missing archive: attack_sprites_transparent_split.zip"
}

if (!(Test-Path $CharactersZip)) {
    throw "Missing archive: character_hp_sprites_split.zip"
}

$TempRoot = Join-Path $Root ".tmp-beatdown-assets"
$RaidPublicRoot = Join-Path $Root "apps/web/public/raid"
$BeatdownRoot = Join-Path $RaidPublicRoot "beatdown"

Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

Expand-Archive -Path $AttackZip -DestinationPath (Join-Path $TempRoot "attack") -Force
Expand-Archive -Path $CharactersZip -DestinationPath (Join-Path $TempRoot "characters") -Force

Remove-Item $BeatdownRoot -Recurse -Force -ErrorAction SilentlyContinue

$HandsDest = Join-Path $BeatdownRoot "player/hands"
$KickDest = Join-Path $BeatdownRoot "player/kick"
$CharacterMapDest = Join-Path $BeatdownRoot "asset-map.json"

New-Item -ItemType Directory -Force -Path $HandsDest | Out-Null
New-Item -ItemType Directory -Force -Path $KickDest | Out-Null

$HandsSource = Join-Path $TempRoot "attack/split_attack_sprites/hands"
$KickSource = Join-Path $TempRoot "attack/split_attack_sprites/right_leg_kick"

Copy-Item -Path (Join-Path $HandsSource "*.png") -Destination $HandsDest -Force
Copy-Item -Path (Join-Path $KickSource "*.png") -Destination $KickDest -Force

$AttackManifest = Join-Path $TempRoot "attack/split_attack_sprites/manifest.json"
if (Test-Path $AttackManifest) {
    Copy-Item -Path $AttackManifest -Destination (Join-Path $BeatdownRoot "attack-manifest.json") -Force
}

$CharacterManifest = Join-Path $TempRoot "characters/manifest.json"
if (Test-Path $CharacterManifest) {
    Copy-Item -Path $CharacterManifest -Destination (Join-Path $BeatdownRoot "characters-manifest.json") -Force
}

$Mappings = @(
    @{
        Source = "character_01_black_boxer"
        BossSlug = "boss-002"
        Label = "black_boxer"
    },
    @{
        Source = "character_02_black_hoodie"
        BossSlug = "boss-003"
        Label = "black_hoodie"
    },
    @{
        Source = "character_03_cigar_hoodie"
        BossSlug = "boss-004"
        Label = "cigar_hoodie"
    },
    @{
        Source = "character_04_leather_headphones"
        BossSlug = "boss-005"
        Label = "leather_headphones"
    },
    @{
        Source = "character_05_fox_hoodie_cap"
        BossSlug = "boss-006"
        Label = "fox_hoodie_cap"
    }
)

$StageMappings = @(
    @{
        SourceFile = "01_full_hp.png"
        TargetFile = "boss-100.png"
        Hp = 100
    },
    @{
        SourceFile = "02_light_damage.png"
        TargetFile = "boss-80.png"
        Hp = 80
    },
    @{
        SourceFile = "03_bruised.png"
        TargetFile = "boss-60.png"
        Hp = 60
    },
    @{
        SourceFile = "04_heavy_damage.png"
        TargetFile = "boss-40.png"
        Hp = 40
    },
    @{
        SourceFile = "05_critical.png"
        TargetFile = "boss-20.png"
        Hp = 20
    },
    @{
        SourceFile = "06_near_defeat.png"
        TargetFile = "boss-0.png"
        Hp = 0
    }
)

$AssetMap = @()

foreach ($Mapping in $Mappings) {
    $SourceDir = Join-Path $TempRoot ("characters/" + $Mapping.Source)
    $BossBeatdownDir = Join-Path $RaidPublicRoot ($Mapping.BossSlug + "/beatdown")

    if (!(Test-Path $SourceDir)) {
        throw ("Missing character folder: " + $Mapping.Source)
    }

    Remove-Item $BossBeatdownDir -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $BossBeatdownDir | Out-Null

    foreach ($Stage in $StageMappings) {
        $SourceFile = Join-Path $SourceDir $Stage.SourceFile
        $TargetFile = Join-Path $BossBeatdownDir $Stage.TargetFile

        if (!(Test-Path $SourceFile)) {
            throw ("Missing character stage: " + $SourceFile)
        }

        Copy-Item -Path $SourceFile -Destination $TargetFile -Force
    }

    $AssetMap += @{
        bossSlug = $Mapping.BossSlug
        source = $Mapping.Source
        label = $Mapping.Label
        beatdownPath = "/raid/" + $Mapping.BossSlug + "/beatdown"
    }
}

$AssetMap | ConvertTo-Json -Depth 5 | Set-Content -Path $CharacterMapDest -Encoding UTF8

Remove-Item $TempRoot -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Beatdown assets imported."
Write-Host ""
Write-Host "Player assets:"
Get-ChildItem $BeatdownRoot -Recurse -File | Select-Object -ExpandProperty FullName
Write-Host ""
Write-Host "Boss beatdown assets:"
Get-ChildItem $RaidPublicRoot -Recurse -File -Filter "boss-*.png" |
    Where-Object { $_.FullName -like "*\beatdown\*" } |
    Select-Object -ExpandProperty FullName
