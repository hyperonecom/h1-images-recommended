Start-Sleep -s 60;
[Net.ServicePointManager]::SecurityProtocol = 'tls12, tls11, tls';
iex(New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/hyperonecom/h1-images-recommended/master/resources/powershell/SetupWindowsImage.ps1');