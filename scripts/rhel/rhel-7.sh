#!/bin/sh
set -eux

systemctl disable systemd-readahead-collect.service
systemctl disable systemd-readahead-drop.service
systemctl disable systemd-readahead-replay.service
systemctl disable tuned.service
systemctl disable rhel-configure.service
systemctl disable rhel-loadmodules.service

# Fix SELinux
restorecon -vR / >> /dev/null && echo 'restorecon success' || echo 'restorecon failed'