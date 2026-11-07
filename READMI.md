Create fresh apk development
npx expo run:android


Uninstall apk
adb uninstall com.netease.cloudmusic
Success
 

Recreate apk
npx expo prebuild --clean
npx expo run:android


$out = "ALL-CODE.txt"; if (Test-Path $out) { Remove-Item $out -Force }; $rootFiles = @("app.json","package.json","index.js","App.tsx","babel.config.js","metro.config.js","eas.json","tsconfig.json"); $all = @(); foreach ($f in $rootFiles) { if (Test-Path $f) { $all += (Resolve-Path $f).Path } }; $src = Get-ChildItem -Path src -Recurse -File -Include *.ts,*.tsx,*.js,*.json -ErrorAction SilentlyContinue | Where-Object { $_.Length -lt 200000 }; $all += $src.FullName; $patches = Get-ChildItem -Path patches -Recurse -File -ErrorAction SilentlyContinue; if ($patches) { $all += $patches.FullName }; $sb = New-Object System.Text.StringBuilder; foreach ($f in $all) { $rel = $f.Replace((Get-Location).Path + '\', ''); [void]$sb.AppendLine(""); [void]$sb.AppendLine("========== $rel =========="); try { [void]$sb.AppendLine((Get-Content $f -Raw -ErrorAction Stop)) } catch { [void]$sb.AppendLine("(read error)") } }; [System.IO.File]::WriteAllText((Join-Path (Get-Location) $out), $sb.ToString(), [System.Text.UTF8Encoding]::new($false)); Write-Host ""; Write-Host "DONE -> $out" -ForegroundColor Green; Write-Host "Files: $($all.Count)"; Write-Host "Size: $([math]::Round((Get-Item $out).Length/1KB,1)) KB"

 