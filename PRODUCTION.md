

cd E:\AppleLocal\apple
 
npx expo prebuild --clean --platform android 
eas login 
npm install
    
 
 
eas build -p android --profile production




Update pass 
npx tsc --noEmit 
npx expo-doctor
npx eas-cli@latest update --channel production --platform android --message "App update"
1.0.6
npx eas-cli@latest update --channel production --platform android --message "Song Delete notification Update Remove Home Section Music video section better performance "


Get all folder structure 
function t($p,$i=''){Get-ChildItem $p -Force|?{$_.Name -notin @('node_modules','.git','android','.expo')}|%{Write-Host "$i$($_.Name)";if($_.PSIsContainer){t $_.FullName "$i   "}}};t .


expo.version → 1.0.5 → 1.0.6

android.versionCode → 7 → 8

ios.buildNumber → "5" → "6"