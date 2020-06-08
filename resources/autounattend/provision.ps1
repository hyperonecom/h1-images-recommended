Start-Sleep -s 60;
iex(New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/hyperonecom/h1-images-recommended/master/resources/powershell/SetupWindowsImage.ps1');