#!/usr/bin/env bash

set -xueo pipefail

declare scope="h1"
declare help="Usage $0 -s [rbx|h1] -i image_id -o [packer|windows] -v vm_service -c credentials_id_or_name"
declare IMAGE=""
declare VM_TYPE="a1.nano"
declare DISK_SERVICE="ssd";
declare DISK_SIZE="10";
declare USER="clouduser"
declare USERDATA="./tests/userdata"
declare SSH_KEY_NAME="";
declare NETWORK="builder-network";

while getopts "s:i:o:v:d:n:c:" opt; do
  case $opt in
    s)
       scope=${OPTARG}
       [ "$scope" == "h1" ]  || [ "$scope" == "rbx" ] ||  exit 1
       ;;
    i) IMAGE=${OPTARG}
       ;;
    v) VM_TYPE=${OPTARG}
       ;;
    c) SSH_KEY_NAME=${OPTARG}
       ;;
    d) DISK_SIZE=${OPTARG}
       ;;
    o) os=${OPTARG}
      [ "$os" == "packer" ]  || [ "$os" == "windows" ] ||  exit 1
       ;;
    n) NETWORK=${OPTARG}
      ;;
    \?)
      echo "Invalid option" >&2
      echo $help >&2
      exit 1
      ;;
    :)
      echo "Option -$OPTARG requires an argument." >&2
      exit 1
      ;;
  esac
done
if [[ $OPTIND -eq 1 ]]; then echo "$help"; exit 2; fi

RBX_CLI="${scope}";
OS_DISK="$DISK_SERVICE,$DISK_SIZE"
VM_NAME=$(echo "image-${IMAGE}-test" | tr -cd 'a-zA-Z0-9\-_ ' )
set +x
PASSWORD=$(openssl rand -hex 15)
set -x

EXTERNAL_IP=$(${RBX_CLI} ip create --query "[].{ip:address}" -o tsv);

if [ "$os" == "windows" ]; then
	INTERNAL_IP=$(${RBX_CLI} network ip create --network $NETWORK -o id);
fi;

if [ "$os" == "packer" ]; then
	INTERNAL_IP=$EXTERNAL_IP
fi

set +x
VM_ID=$(${RBX_CLI} vm create --image $IMAGE \
    --name $VM_NAME \
    --username $USER \
    --password $PASSWORD \
    --ssh $SSH_KEY_NAME \
    --type $VM_TYPE \
    --os-disk $OS_DISK \
    --userdata-file $USERDATA \
    --ip $INTERNAL_IP \
    -o tsv | cut -f1 )
set -x;

VM_IP=$(${RBX_CLI} vm nic list --vm $VM_ID --query "[].ip[*].address" -o tsv|head -1)
VM_DISK_ID=$(${RBX_CLI} vm disk list --vm $VM_ID --output tsv --query "[].{disk:disk._id}")

RBX_CLI="$RBX_CLI" VM_ID="$VM_ID" IMAGE_ID="$IMAGE" USER="$USER" IP="$EXTERNAL_IP" HOSTNAME="$VM_NAME" bats "./tests/common.bats"

if [ "$os" == "packer" ]; then
	for i in {1..300}; do echo -n '.'; sleep 1; done; echo "";
	${RBX_CLI} vm serialport log --vm "$VM_ID";
	ping -c 3 "$VM_IP";
	RBX_CLI="$RBX_CLI" USER="$USER" IP="$EXTERNAL_IP" HOSTNAME="$VM_NAME" bats "./tests/${os}.bats"
fi

if [ "$os" == "windows" ]; then
	for i in {1..120}; do echo -n '.'; sleep 1; done; echo "";
	${RBX_CLI} vm serialport log --vm "$VM_ID";
	${RBX_CLI} ip associate --ip $EXTERNAL_IP --private-ip $INTERNAL_IP;
	#changePassword
  declare USER="Administrator"
  new_pass=$(${RBX_CLI} vm  passwordreset --user $USER  --vm $VM_ID --output tsv) || error "Could not change password"
	${RBX_CLI} vm serialport log --vm "$VM_ID" --port 2;
  if [ "$new_pass" == "" ]; then error "Could not change password"; fi
  echo "User: $USER";
  echo "Pass: $new_pass";
  pwsh "tests/tests.ps1" -IP "$EXTERNAL_IP" -Hostname "$VM_NAME" -User "$USER" -Pass "\"$new_pass\"";
fi

#${RBX_CLI} vm delete --yes --vm "$VM_ID"
#${RBX_CLI} disk delete --yes  --disk "$VM_DISK_ID"
