#!/bin/sh
set -eux
sudo ln -s /proc/self/mounts /etc/mtab;
DEVICE=$(df -P . | awk 'END{print $1}')
DISK_UUID=$(blkid -s UUID -o value "$DEVICE")
echo "UUID=$DISK_UUID    /    ext4    defaults    1    1" > /etc/fstab