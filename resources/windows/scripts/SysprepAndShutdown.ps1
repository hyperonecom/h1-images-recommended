param(
   [String] $Logfile = "C:\Windows\Temp\Sysprep.log",
   [String] $SysprepScriptsDir = "C:\Program Files\Google\Compute Engine\sysprep"
 )

function LogWrite {
   Param ([string]$logstring)
   $now = Get-Date -format s
   Add-Content $Logfile -value "$now $logstring"
   Write-Host $logstring
}

LogWrite "Disabling IPv6"
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters" -Name "DisabledComponents" -Value 0x000000ff -PropertyType DWORD -Force

LogWrite "Calling google sysprep script"
& "$($SysprepScriptsDir)\sysprep.ps1"
