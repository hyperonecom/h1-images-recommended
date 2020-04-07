param(
  [String] $Repo = "https://raw.githubusercontent.com/hyperonecom/h1-images-recommended/windows/resources/powershell/",
  [String] $TempDir = "C:\Windows\Temp\",
  [String] $Logfile = "$($TempDir)SetupWindowsImage.log"
)

Start-Transcript -path $Logfile -append

Invoke-WebRequest -Uri "$($Repo)ConfigureMicrosoftUpdates.bat" -OutFile "$($TempDir)\ConfigureMicrosoftUpdates.bat"
Invoke-WebRequest -Uri "$($Repo)InstallWindowsUpdates.ps1" -OutFile "$($TempDir)\InstallWindowsUpdates.ps1"
Invoke-WebRequest -Uri "$($Repo)InstallGooget.ps1" -OutFile "$($TempDir)\InstallGooget.ps1"
Invoke-WebRequest -Uri "$($Repo)InstallGoogleAgent.ps1" -OutFile "$($TempDir)\InstallGoogleAgent.ps1"
Invoke-WebRequest -Uri "$($Repo)SysprepAndShutdown.ps1" -OutFile "$($TempDir)\SysprepAndShutdown.ps1"

& "$($TempDir)\InstallGooget.ps1"
& "$($TempDir)\InstallGoogleAgent.ps1"
cmd.exe /c "$($TempDir)\ConfigureMicrosoftUpdates.bat"
& "$($TempDir)\InstallWindowsUpdates.ps1"
#& "$($TempDir)\SysprepAndShutdown.ps1"

Stop-Transcript
