#!/bin/sh
set -eux

systemctl disable systemd-readahead-collect.service
systemctl disable systemd-readahead-drop.service
systemctl disable systemd-readahead-replay.service
systemctl disable tuned.service
systemctl disable rhel-configure.service
systemctl disable rhel-loadmodules.service
systemctl disable rpcbind
systemctl disable rpcbind.socket

# disalbe LLM for systemd
 sed -i -e 's/#LLMNR=yes/LLMNR=no/g' /etc/systemd/resolved.conf

# Fix SELinux
restorecon -vR / >> /dev/null && echo 'restorecon success' || echo 'restorecon failed'