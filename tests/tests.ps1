param(
 [string]$Hostname,
 [string]$IP,
 [string]$User,
 [string]$Pass

)

$secpasswd = ConvertTo-SecureString $Pass -AsPlainText -Force
$creds = New-Object System.Management.Automation.PSCredential ($User, $secpasswd)

$computer_name = $( Invoke-Command -ComputerName $IP -Credential $creds -UseSSL -ScriptBlock { echo $env:ComputerName } -Authentication Basic)

if($Hostname -contains $computer_name.ToLower()){
	echo "Hostname '$($computer_name.ToLower())' doesn't match '$($Hostname)'"
	exit 1
}

