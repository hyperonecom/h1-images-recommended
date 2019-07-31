#!/bin/sh
set -eux
SCOPE_CODE=$(echo "${SCOPE_NAME}" | tr '[:upper:]' '[:lower:]');
SYSTEM_ID=$(sed -E -n 's/^ID="*(.+?)"*/\1/gp' /etc/os-release)
VERSION_CODENAME=$(sed -E -n 's/^VERSION_CODENAME="*(.+?)"*/\1/gp' /etc/os-release)
export
curl -fsSL "${REPOSITORY}/gpg.public.txt" | apt-key add -
echo "deb [arch=amd64] ${REPOSITORY}/linux/${SYSTEM_ID} ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/${SCOPE_CODE}.list
apt-get update
apt-get install -y "${CLI_PACKAGE}"
