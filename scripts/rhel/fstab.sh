#!/bin/sh
set -eux
rm -f /etc/mtab
ln -s /proc/self/mounts /etc/mtab;

ROOT_DEVICE=$(df -P / | awk 'END{print $1}')
ROOT_DISK_UUID=$(blkid -s UUID -o value "$ROOT_DEVICE")
ROOT_DISK_FS=$(blkid -s TYPE -o value "$ROOT_DEVICE")
echo "UUID=$ROOT_DISK_UUID    /    $ROOT_DISK_FS    defaults    1    1" > /etc/fstab

BOOT_DEVICE=$(df -P /boot/ | awk 'END{print $1}')
BOOT_DISK_UUID=$(blkid -s UUID -o value "$BOOT_DEVICE")
BOOT_DISK_FS=$(blkid -s TYPE -o value "$BOOT_DEVICE")
echo "UUID=$BOOT_DISK_UUID    /boot    $BOOT_DISK_FS    defaults    1    1" >> /etc/fstab
