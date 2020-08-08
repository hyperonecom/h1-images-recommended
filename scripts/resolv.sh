#!/bin/sh
set -eux
echo 'nameserver 9.9.9.9' > /etc/resolv.conf
echo 'nameserver 8.8.8.8' >> /etc/resolv.conf
cat /etc/resolv.conf > /run/resolvconf/resolv.conf || echo 'Failed set /run/resolvconf/resolv.conf'
cat /etc/resolv.conf > /run/systemd/resolve/stub-resolv.conf || echo 'Failed set /run/systemd/resolve/stub-resolv.conf'