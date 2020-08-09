#!/bin/bash
set -eux
SCOPE_CODE=$(echo "${SCOPE_NAME}" | tr '[:upper:]' '[:lower:]');
. /etc/os-release;
echo -e "[${SCOPE_CODE}_stable]\nname = ${SCOPE_NAME} - stable repository\nenabled = 1\nbaseurl = ${REPOSITORY}/linux/${ID}/${VERSION_ID/\.*/}/stable/\ngpgcheck=1\ngpgkey=${REPOSITORY}/gpg.public.txt" > "/etc/yum.repos.d/${SCOPE_CODE}.repo"
yum -y install "${CLI_PACKAGE}"
