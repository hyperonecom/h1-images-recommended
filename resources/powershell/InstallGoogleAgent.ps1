param(
   [String] $GoogetRoot = "C:\ProgramData\GooGet",
   [String] $GoogetExe = "C:\ProgramData\GooGet\googet.exe",
   [String] $GoogleRepo = "https://googet.packages.hyperone.cloud/repo"
 )

Write-Host "Adding google repo $GoogleRepo"
& $GoogetExe -root $GoogetRoot addrepo google-compute-engine-stable $GoogleRepo

Write-Host "Installing google-compute-engine-windows google-compute-engine-sysprep"
& $GoogetExe -root $GoogetRoot -noconfirm install google-compute-engine-windows google-compute-engine-sysprep

Write-Host "Installing google-compute-engine-windows google-compute-engine-auto-updater"
& $GoogetExe -root $GoogetRoot -noconfirm install google-compute-engine-auto-updater



