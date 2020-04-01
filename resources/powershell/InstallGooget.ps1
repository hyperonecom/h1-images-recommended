param(
   [String] $GoogetSource = "http://googet.packages.hyperone.cloud/googet.exe",
   [String] $GoogleRepo = "http://googet.packages.hyperone.cloud/repo",
   [String] $GoogetRoot = "C:\ProgramData\GooGet"
)

$GoogetExe = "$($env:temp)\googet.exe"

Write-Host "Downloading googet from $GoogetSource"
Invoke-WebRequest -Uri $GoogetSource -OutFile $GoogetExe

Write-Host "Installing googet from $GoogleRepo"
& $GoogetExe -root $GoogetRoot -noconfirm install -sources $GoogleRepo googet

rm $GoogetExe
