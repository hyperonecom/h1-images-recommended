#!/bin/sh
[ -f "/etc/hosts" ] && rm /etc/hosts
if [ $PACKER_BUILD_NAME != 'docker' ]; then
	cloud-init clean
fi;
