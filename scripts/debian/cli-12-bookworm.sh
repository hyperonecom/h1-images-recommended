#!/bin/sh
SCOPE_CODE=$(echo "${SCOPE_NAME}" | tr '[:upper:]' '[:lower:]');
. /etc/os-release
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg2;
VERSION_CODENAME=$(sed -E -n 's/VERSION=.*\((.+?)\).*$/\1/gp' /etc/os-release)

# This is a change from previous versions of Debian where the gpg keys were stored in /etc/apt/trusted.gpg
# The gpg keys are stored in separate files in /etc/apt/trusted.gpg.d with extension .asc
curl -fsSL "${REPOSITORY}/gpg.public.txt" > "/etc/apt/trusted.gpg.d/${SCOPE_CODE}.asc"

echo "deb [arch=amd64] ${REPOSITORY}/linux/${ID} ${VERSION_CODENAME} stable" > "/etc/apt/sources.list.d/${SCOPE_CODE}.list"
apt-get update
apt-get install -y "${CLI_PACKAGE}"
