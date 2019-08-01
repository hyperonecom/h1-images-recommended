#!/bin/sh
set -eux
SCOPE_CODE=$(echo "${SCOPE_NAME}" | tr '[:upper:]' '[:lower:]');
. /etc/os-release;
apt-get install -y gnupg2
curl -fsSL "${REPOSITORY}/gpg.public.txt" | apt-key add -
echo "deb [arch=amd64] ${REPOSITORY}/linux/${ID} ${VERSION_CODENAME} stable" > "/etc/apt/sources.list.d/${SCOPE_CODE}.list"
apt-get update
apt-get install -y "${CLI_PACKAGE}"
