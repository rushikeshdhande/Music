Create fresh apk development
npx expo run:android


Uninstall apk
adb uninstall com.netease.cloudmusic
Success
 

Recreate apk
npx expo prebuild --clean
npx expo run:android


$out = "ALL-CODE.txt"; if (Test-Path $out) { Remove-Item $out -Force }; $rootFiles = @("app.json","package.json","index.js","App.tsx","babel.config.js","metro.config.js","eas.json","tsconfig.json"); $all = @(); foreach ($f in $rootFiles) { if (Test-Path $f) { $all += (Resolve-Path $f).Path } }; $src = Get-ChildItem -Path src -Recurse -File -Include *.ts,*.tsx,*.js,*.json -ErrorAction SilentlyContinue | Where-Object { $_.Length -lt 200000 }; $all += $src.FullName; $patches = Get-ChildItem -Path patches -Recurse -File -ErrorAction SilentlyContinue; if ($patches) { $all += $patches.FullName }; $sb = New-Object System.Text.StringBuilder; foreach ($f in $all) { $rel = $f.Replace((Get-Location).Path + '\', ''); [void]$sb.AppendLine(""); [void]$sb.AppendLine("========== $rel =========="); try { [void]$sb.AppendLine((Get-Content $f -Raw -ErrorAction Stop)) } catch { [void]$sb.AppendLine("(read error)") } }; [System.IO.File]::WriteAllText((Join-Path (Get-Location) $out), $sb.ToString(), [System.Text.UTF8Encoding]::new($false)); Write-Host ""; Write-Host "DONE -> $out" -ForegroundColor Green; Write-Host "Files: $($all.Count)"; Write-Host "Size: $([math]::Round((Get-Item $out).Length/1KB,1)) KB"



all code provide do nto rduce code get all code and fix bug song are delete but show please fix this error and and song is deleted to do now show this song in this page instant remove recently added section  and recently added section song long press to show popup down to up this popup top side show song image right side show Song name and artist name and down side add one divider and add down side fetures Pin Album - Unpin Album Delete Song clik to show popup this popup Are you sure you want o delete this album from your library This also remove songs from your favourites and from any playlist you made. and down side show Delete FROM Library and down side show Cancle Recently added sectionsoong long press to Play next , Favourite - Undo favorites  and library screen recently added section song is pin to show top side this place Playlist name above show and libraru title name down side show this song and pin song and recently added section song click to rediract this song album page  getting all code




tyach production version 1.0.6 chalu ahe current ani mala apk madhe mager changes kelete tr mala 1.1.0 update takachya ani ata mala new production apk banava lagen apk icon pn name changes kelet mi tr 1.0.6 apk la madhe maa kas update takata yaek tya madhe popup madhe new apk url takachya New Update Available ani khali downloade button click kel ki apk url la gele pahije 