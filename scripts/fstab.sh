#!/bin/sh
set -eux
rm -f /etc/mtab
ln -s /proc/self/mounts /etc/mtab;
DEVICE=$(df -P . | awk 'END{print $1}')
DISK_UUID=$(blkid -s UUID -o value "$DEVICE")
DISK_FS=$(blkid -s TYPE -o value "$DEVICE")
echo "UUID=$DISK_UUID    /    $DISK_FS    defaults    1    1" > /etc/fstab