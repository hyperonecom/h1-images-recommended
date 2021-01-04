#!/bin/sh
set -eux

yum install -y podman
systemctl enable nftables
systemctl disable dbus-org.freedesktop.nm-dispatcher.service
systemctl disable dbus-org.freedesktop.timedate1.service
systemctl disable loadmodules.service
systemctl disable nfs-convert.service
systemctl disable timedatex.service
systemctl disable sshd-keygen@.service
systemctl disable kdump.service
systemctl disable rpcbind
systemctl disable rpcbind.socket

# disalbe LLM for systemd
sed -i -e 's/#LLMNR=yes/LLMNR=no/g' /etc/systemd/resolved.conf

# Fix SELinux
restorecon -vR / >> /dev/null && echo 'restorecon success' || echo 'restorecon failed'