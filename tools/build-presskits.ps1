# Builds the press kit for every artist. Run it after changing a rider, or after
# adding, replacing or removing photos:
#   powershell -ExecutionPolicy Bypass -File tools\build-presskits.ps1
#
# For each folder in assets\presskit\<artist>\ it:
#   1. renames new photos in photos\ to <ARTIST>-NN.jpg (next free number)
#   2. makes a small preview of each photo in thumbs\ for the page grid
#   3. prints <ARTIST>-rider.pdf from the rider on the artist page (needs Edge)
#   4. builds <ARTIST>-presskit.zip with every photo at 3000px (poster-ready, and
#      it keeps the ZIP under GitHub's 100 MB file limit) plus the .txt and .pdf files
#   5. rewrites the photo grid on <artist>.html between the PHOTOS:START/END markers
#
# Originals stay untouched in photos\; the page links to them for full size.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$site      = Resolve-Path (Join-Path $PSScriptRoot '..')
$root      = Join-Path $site 'assets\presskit'
$thumbW    = 600      # preview width in px (grid tiles are ~250px, so sharp on retina)
$zipEdge   = 3000     # long edge in px for the photos in the ZIP
$times     = [char]0x00D7
$down      = [char]0x2193
$edge      = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
               "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$jpegCodec =[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'

function Save-Resized($src, $dst, $maxW, $maxH, $quality) {
    $img = [System.Drawing.Image]::FromFile($src)
    try {
        $scale = [math]::Min(1.0, [math]::Min([double]$maxW / $img.Width, [double]$maxH / $img.Height))
        $w = [int][math]::Round($img.Width * $scale); $h = [int][math]::Round($img.Height * $scale)
        $bmp = New-Object System.Drawing.Bitmap $w, $h
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.SmoothingMode = 'HighQuality'
        $g.DrawImage($img, 0, 0, $w, $h)
        $p = New-Object System.Drawing.Imaging.EncoderParameters 1
        $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$quality)
        $bmp.Save($dst, $jpegCodec, $p)
        $g.Dispose(); $bmp.Dispose()
    } finally { $img.Dispose() }
}

Get-ChildItem $root -Directory | ForEach-Object {
    $slug   = $_.Name
    $name   = $slug.ToUpper()
    $photos = Join-Path $_.FullName 'photos'
    $thumbs = Join-Path $_.FullName 'thumbs'
    New-Item -ItemType Directory -Force $thumbs | Out-Null
    if (-not (Test-Path $photos)) { Write-Host "$name - no photos folder, skipped"; return }

    # 1. rename anything that isn't <ARTIST>-NN.jpg yet
    $pattern = "^$name-(\d+)\.jpg$"
    $used = @(Get-ChildItem $photos -File | Where-Object { $_.Name -match $pattern } | ForEach-Object { [int]($_.Name -replace $pattern, '$1') })
    $next = if ($used.Count) { [int]($used | Measure-Object -Maximum).Maximum + 1 } else { 1 }
    Get-ChildItem $photos -File | Where-Object { $_.Name -notmatch $pattern -and $_.Extension -match '^\.jpe?g$' } | Sort-Object Name | ForEach-Object {
        $new = '{0}-{1:D2}.jpg' -f $name, $next; $next++
        Write-Host "  rename $($_.Name) -> $new"
        Rename-Item $_.FullName $new
    }

    $files = @(Get-ChildItem $photos -File | Where-Object { $_.Name -match $pattern } | Sort-Object Name)

    # 2. previews (only when missing or older than the photo)
    foreach ($f in $files) {
        $t = Join-Path $thumbs $f.Name
        if (-not (Test-Path $t) -or (Get-Item $t).LastWriteTime -lt $f.LastWriteTime) {
            Save-Resized $f.FullName $t $thumbW 100000 80
        }
    }
    # drop previews whose photo was removed
    Get-ChildItem $thumbs -File | Where-Object { -not (Test-Path (Join-Path $photos $_.Name)) } | Remove-Item

    # 2b. rider PDF, printed from the rider on the artist page (one source of truth)
    $page = Join-Path $site "$slug.html"
    $pdf  = Join-Path $_.FullName "$name-rider.pdf"
    if (Test-Path $page) {
        $html = [IO.File]::ReadAllText($page)
        $grid = [regex]::Match($html, '(?s)(<div class="rider-grid">.*</div>)\s*</details>')
        if ($grid.Success) {
            $intro = [regex]::Match($html, '(?s)<p class="rider-intro">(.*?)</p>').Groups[1].Value -replace '\s+', ' '
            $date  = (Get-Date).ToString('MMMM yyyy', [Globalization.CultureInfo]::InvariantCulture)
            $logo  = ([Uri](Join-Path $site 'assets\images\logo.png')).AbsoluteUri
            $doc   = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'rider-template.html'))
            $doc   = $doc.Replace('{{ARTIST}}', $name).Replace('{{SLUG}}', $slug).Replace('{{INTRO}}', $intro).
                          Replace('{{GRID}}', $grid.Groups[1].Value).Replace('{{LOGO}}', $logo).Replace('{{DATE}}', $date)
            $tmp   = Join-Path ([IO.Path]::GetTempPath()) "rider-$slug.html"
            [IO.File]::WriteAllText($tmp, $doc, (New-Object System.Text.UTF8Encoding $false))
            if (Test-Path $pdf) { Remove-Item $pdf -Force }
            Start-Process -Wait -FilePath $edge -ArgumentList '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                '--virtual-time-budget=5000', "--print-to-pdf=$pdf", ([Uri]$tmp).AbsoluteUri
            Remove-Item $tmp
            if (-not (Test-Path $pdf)) { Write-Host "  warning: rider PDF for $name was not created" }
        }
    }

    # 3. ZIP with poster-ready copies
    $stage = Join-Path ([IO.Path]::GetTempPath()) "presskit-$slug"
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    New-Item -ItemType Directory $stage | Out-Null
    foreach ($f in $files) { Save-Resized $f.FullName (Join-Path $stage $f.Name) $zipEdge $zipEdge 90 }
    Get-ChildItem $_.FullName -File | Where-Object Extension -in '.txt', '.pdf' | Copy-Item -Destination $stage
    $zip = Join-Path $_.FullName "$name-presskit.zip"
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
    Remove-Item $stage -Recurse -Force
    $zipMb = [math]::Round((Get-Item $zip).Length / 1MB, 1)

    # 4. photo grid on the artist page
    $page = Join-Path $site "$slug.html"
    if (Test-Path $page) {
        $html = [IO.File]::ReadAllText($page)
        $nl = if ($html.Contains("`r`n")) { "`r`n" } else { "`n" }
        $cards = foreach ($f in $files) {
            $num = $f.BaseName -replace "^$name-", ''
            $img = [System.Drawing.Image]::FromFile($f.FullName); $w = $img.Width; $h = $img.Height; $img.Dispose()
            $timg = [System.Drawing.Image]::FromFile((Join-Path $thumbs $f.Name)); $tw = $timg.Width; $th = $timg.Height; $timg.Dispose()
            $mb = ('{0:N1}' -f ($f.Length / 1MB)).Replace(',', '.')
            $orig = "assets/presskit/$slug/photos/$($f.Name)"
            @(
                '      <figure class="photo-card">',
                "        <a href=`"$orig`" class=`"photo-thumb`" data-lightbox aria-label=`"View $name photo $num full size`">",
                "          <img src=`"assets/presskit/$slug/thumbs/$($f.Name)`" alt=`"$name, press photo $num`" width=`"$tw`" height=`"$th`" loading=`"lazy`">",
                '        </a>',
                '        <figcaption>',
                "          <span class=`"photo-meta mono`">$w $times $h px</span>",
                "          <a href=`"$orig`" download data-goatcounter-click=`"presskit-photo-$name-$num`" data-goatcounter-title=`"$name photo $num`" class=`"photo-dl mono`">Download $down</a>",
                '        </figcaption>',
                '      </figure>'
            ) -join $nl
        }
        $block = "<!-- PHOTOS:START (generated by tools/build-presskits.ps1, edits here are overwritten) -->$nl" + ($cards -join $nl) + "$nl      <!-- PHOTOS:END -->"
        $new = [regex]::Replace($html, '<!-- PHOTOS:START.*?<!-- PHOTOS:END -->', { param($m) $block }, 'Singleline')
        # keep the ZIP size in the button label up to date
        $new = [regex]::Replace($new, "(Download everything \(ZIP)[^)]*(\))", "`$1, $zipMb MB`$2")
        if ($new -ne $html) { [IO.File]::WriteAllText($page, $new, (New-Object System.Text.UTF8Encoding $false)) }
        if ($new -notmatch 'PHOTOS:START') { Write-Host "  warning: no PHOTOS markers in $slug.html" }
    }

    Write-Host "$name - $($files.Count) photos, ZIP $zipMb MB"
}
