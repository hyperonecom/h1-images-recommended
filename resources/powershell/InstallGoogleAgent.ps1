param(
   [String] $GoogetRoot = "C:\ProgramData\GooGet",
   [String] $GoogetExe = "C:\ProgramData\GooGet\googet.exe",
   [String] $GoogleRepo = "https://5e5fdc83d9fe4b5b0d0338f1.website.pl-waw-1.hyperone.cloud/repo"
 )

Write-Host "Adding google repo $GoogleRepo"
& $GoogetExe -root $GoogetRoot addrepo google-compute-engine-stable $GoogleRepo

Write-Host "Installing google-compute-engine-windows google-compute-engine-sysprep"
& $GoogetExe -root $GoogetRoot -noconfirm install google-compute-engine-windows google-compute-engine-sysprep

Write-Host "Installing google-compute-engine-windows google-compute-engine-auto-updater"
& $GoogetExe -root $GoogetRoot -noconfirm install google-compute-engine-auto-updater



