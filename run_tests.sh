#!/usr/bin/env bash

set -ueo pipefail

declare scope="h1"
declare help="Usage $0 -s [rbx|h1] -i image_id -v vm_service -c credentials_id_or_name"
declare IMAGE=""
declare VM_TYPE="a1.nano"
declare DISK_SERVICE="ssd";
declare USER="clouduser"
declare USERDATA="./tests/userdata"
declare SSH_KEY_NAME="";

while getopts "s:i:o:v:c:" opt; do
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
OS_DISK="$DISK_SERVICE,10"
VM_NAME="image-${IMAGE}-test"
PASSWORD=$(openssl rand -hex 15)

VM_ID=$(${RBX_CLI} vm create --image $IMAGE \
    --name $VM_NAME \
    --username $USER \
    --password $PASSWORD \
    --ssh $SSH_KEY_NAME \
    --type $VM_TYPE \
    --os-disk $OS_DISK \
    --userdata-file $USERDATA \
    -o tsv | cut -f1 )

VM_IP=$(${RBX_CLI} vm nic list --vm $VM_ID --query "[].ip[*].address" -o tsv|head -1)
VM_DISK_ID=$(${RBX_CLI} vm disk list --vm $VM_ID --output tsv --query "[].{disk:disk._id}")

RBX_CLI="$RBX_CLI" VM_ID="$VM_ID" IMAGE_ID="$IMAGE" USER="$USER" IP="$VM_IP" HOSTNAME="$VM_NAME" bats "./tests/common.bats"
for i in {1..240}; do echo -n '.'; sleep 1; done; echo "";
${RBX_CLI} vm serialport log --vm "$VM_ID";
ping -c 3 "$VM_IP";
RBX_CLI="$RBX_CLI" USER="$USER" IP="$VM_IP" HOSTNAME="$VM_NAME" bats "./tests/linux.bats"
${RBX_CLI} vm delete --yes --vm "$VM_ID"
${RBX_CLI} disk delete --yes  --disk "$VM_DISK_ID"