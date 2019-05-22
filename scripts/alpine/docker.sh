#!/bin/sh
set -eux
apk add docker
if [ $PACKER_BUILD_NAME != 'docker' ]; then
	rc-update add docker boot
fi;
