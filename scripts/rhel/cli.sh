#!/bin/sh
set -eux
echo '62.181.8.127 rhui.pl-waw-1.hyperone.cloud'  | tee -a /etc/hosts

SCOPE_CODE=$(echo "${SCOPE_NAME}" | tr '[:upper:]' '[:lower:]');
. /etc/os-release
VERSION_ID=$(echo $VERSION_ID | grep -E '^[0-9]+' -o)
echo -e "[${SCOPE_CODE}_stable]\nname = ${SCOPE_NAME} - stable repository\nenabled = 1\nbaseurl = ${REPOSITORY}/linux/${ID}/${VERSION_ID}/stable/\ngpgcheck=1\ngpgkey=${REPOSITORY}/gpg.public.txt" > "/etc/yum.repos.d/${SCOPE_CODE}.repo";
yum -y install "${CLI_PACKAGE}"
# Remove /etc/host to manage by cloud-init
rm -f /etc/hosts
