param(
   [String] $GoogetSource = "http://5e5fdc83d9fe4b5b0d0338f1.website.pl-waw-1.hyperone.cloud/googet.exe",
   [String] $GoogleRepo = "http://5e5fdc83d9fe4b5b0d0338f1.website.pl-waw-1.hyperone.cloud/repo",
   [String] $GoogetRoot = "C:\ProgramData\GooGet"
)

$GoogetExe = "$($env:temp)\googet.exe"

Write-Host "Downloading googet from $GoogetSource"
Invoke-WebRequest -Uri $GoogetSource -OutFile $GoogetExe

Write-Host "Installing googet from $GoogleRepo"
& $GoogetExe -root $GoogetRoot -noconfirm install -sources $GoogleRepo googet

rm $GoogetExe
