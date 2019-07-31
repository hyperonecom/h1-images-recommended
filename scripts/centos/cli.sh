#!/bin/sh
set -eux
SCOPE_CODE=$(echo "${SCOPE_NAME}" | tr '[:upper:]' '[:lower:]');
SYSTEM_ID=$(sed -E -n 's/^ID="*(.+?)"*/\1/gp' /etc/os-release)
VERSION_ID=$(sed -E -n 's/^VERSION_ID="*(.+?)"*/\1/gp' /etc/os-release)
echo -e "[${SCOPE_CODE}_stable]\nname = ${SCOPE_NAME} - stable repository\nbaseurl = ${REPOSITORY}/linux/${SYSTEM_ID}/${VERSION_ID}/stable/\ngpgcheck=1\ngpgkey=${REPOSITORY}/gpg.public.txt";
yum makecache
yum -y install "${CLI_PACKAGE}"
