#!/usr/bin/env bash

set -xeo pipefail

declare scope="h1"
declare help="Usage $0 -s [rbx|h1] -i image_id -o [packer|windows] -v vm_service -c credentials_id_or_name -n network_id_or_name -p project_id"
declare IMAGE=""
declare VM_TYPE="a1.nano"
declare DISK_SERVICE="/billing/project/platform/service/562fb685a3e575771b599091" #ssd
declare DISK_SIZE="10";
declare USER="clouduser"
declare USERDATA="./tests/userdata"
declare SSH_KEY_NAME="";
declare NETWORK="builder-network";
declare NETWORK_PUBLIC="/networking/pl-waw-1/project/000000000000000000000000/network/5784e97be2627505227b578c";
declare PROJECT=""

while getopts "s:i:o:v:d:n:c:p:" opt; do
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
    p) PROJECT=${OPTARG}
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

RBX_CLI="/bin/${scope}";
${RBX_CLI} iam project select --project ${PROJECT}

IMAGE_JSON=$(${RBX_CLI} storage image show --image ${IMAGE} -o json)
IMAGE_NAME=$(echo $IMAGE_JSON | jq -r .name | sed -e 's/[^a-zA-Z0-9\-]/_/g' -e 's/__*/_/g' -e 's/_$//g' )
IMAGE_URI=$(echo $IMAGE_JSON | jq -r .uri)
IMAGE_ID=$(echo $IMAGE_JSON | jq -r .id)
VM_NAME=$(echo "image-${IMAGE_ID}-test" | tr -cd 'a-zA-Z0-9\-_ ' )

function cleanup () {
  VM_DISK_ID=$(${RBX_CLI} storage disk list --vm $VM_ID --output tsv --query "[].{disk:id}")

  ${RBX_CLI} compute vm delete --vm "$VM_ID"
  ${RBX_CLI} storage disk delete --disk "$VM_DISK_ID"
}

function delay () {
  set +x;

  seq 1 $1 | while read i; do
    echo "Delay $i / $1 seconds"
    sleep 1
  done
  set -x

}

function waitforssh () {
  set +x;

  local HOST=${1:?}
  local PORT=${2:-22}
  local TIMEOUT=${3:-1}
  local COUNT=0
  local MAX_RETRIES=24
  local DELAY=5

  while ! nc -z -w $TIMEOUT $HOST $PORT; do
      echo "Waited $((COUNT++ * DELAY)) sec. for ${HOST}:${PORT} to become available..."
      sleep ${DELAY}
      if [ $COUNT -gt $MAX_RETRIES ]; then
        echo "Maximum retries reached for ${HOST}:${PORT} to become available"
        exit 1
      fi
  done

  echo "${HOST}:${PORT} is now available"
  set -x
}

set +x
PASSWORD=$(openssl rand -hex 15)
set -x

EXTERNAL_IP=$(${RBX_CLI} networking ip create --query "[].{ip:uri}" -o tsv)

if [ "$os" == "windows" ]; then
	INTERNAL_IP=$(${RBX_CLI} networking network ip create --network $NETWORK -o id)
fi;

if [ "$os" == "packer" ]; then
	INTERNAL_IP=$EXTERNAL_IP
  NETWORK=$NETWORK_PUBLIC
fi

start_time=$(date +'%s')

userdata_file=$(mktemp)

sed \
  -e "s/%%REQUEST_TIME%%/${start_time}/g" \
  -e "s@%%INFLUXDB_HOST%%@${INFLUXDB_HOST}@g" \
  -e "s/%%INFLUXDB_USER%%/${INFLUXDB_USER}/g" \
  -e "s/%%INFLUXDB_PASSWORD%%/${INFLUXDB_PASSWORD}/g" \
  -e "s/%%VM_TYPE%%/${VM_TYPE}/g" \
  -e "s/%%SCOPE%%/${SCOPE}/g" \
  -e "s/%%IMAGE_ID%%/${IMAGE_ID}/g" \
  -e "s/%%IMAGE_NAME%%/${IMAGE_NAME}/g" \
  "$USERDATA" > $userdata_file

VM_ID=$(${RBX_CLI} compute vm create \
    --image $IMAGE_URI \
    --name $VM_NAME \
    --username $USER \
    --password $PASSWORD \
    --credential type=ssh,value="$SSH_KEY_NAME" \
    --service $VM_TYPE \
    --disk name=$VM_NAME-os,service=$DISK_SERVICE,size=$DISK_SIZE \
    --netadp network=$NETWORK,ip=$INTERNAL_IP \
    --user-metadata "$(base64 -w 0 < $userdata_file)" \
    -o tsv | cut -f1 )
echo "VM created: ${VM_ID}"

VM_IP=$(${RBX_CLI} networking ip show --ip $EXTERNAL_IP --query "[].{ip:address}" -o tsv)

trap cleanup EXIT

RBX_CLI="$RBX_CLI" VM_ID="$VM_ID" IMAGE_ID="$IMAGE_ID" USER="$USER" IP="$VM_IP" HOSTNAME="$VM_NAME" bats "./tests/common.bats"

if [ "$os" == "packer" ]; then
  waitforssh $VM_IP
  ${RBX_CLI} compute vm serialport --vm "$VM_ID" || echo 'Serialport not available'
  ip -s -s neigh flush "$VM_IP" || echo 'Failed to delete VM IP from local ARP table on build host'
	ping -c 3 "$VM_IP";
	RBX_CLI="$RBX_CLI" USER="$USER" IP="$VM_IP" HOSTNAME="$VM_NAME" bats "./tests/${os}.bats"
fi

if [ "$os" == "windows" ]; then
  delay 120
	${RBX_CLI} compute vm serialport --vm "$VM_ID";
	${RBX_CLI} networking ip associate --ip $EXTERNAL_IP --private-ip $INTERNAL_IP;
	#changePassword
  declare USER="Administrator"
  new_pass=$(${RBX_CLI} compute vm password_reset --user $USER --vm $VM_ID --output tsv) || error "Could not change password"
	${RBX_CLI} compute vm serialport --vm "$VM_ID" --number 2;
  if [ "$new_pass" == "" ]; then error "Could not change password"; fi
  echo "User: $USER";
  echo "Pass: $new_pass";
  pwsh "tests/tests.ps1" -IP "$VM_IP" -Hostname "$VM_NAME" -User "$USER" -Pass "\"$new_pass\"";
fi
