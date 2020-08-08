#!/bin/sh
set -eux
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )
echo 'nameserver 9.9.9.9' > /etc/resolv.conf
echo 'nameserver 8.8.8.8' >> /etc/resolv.conf
dnf -y update
dnf -y install vim curl redhat-lsb-core nano
dnf clean all
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
echo 'omit_drivers+="floppy"' > /etc/dracut.conf.d/nofloppy.conf
# Install Grub
dnf -y install grub2-efi-x64 shim-x64
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub
grub2-mkconfig -o /boot/grub2/grub.cfg
grub2-set-default 0
grub2-install "${DEVICE_DISK}"; # legacy BIOS install
# UEFI install
mkdir -p  /boot/efi/EFI/BOOT
grub2-mkconfig -o /boot/efi/EFI/fedora/grub.cfg
find /boot/efi/EFI
# rm -f /boot/efi/EFI/BOOT/BOOTX64.EFI
# cp /boot/efi/EFI/fedora/grubx64.efi /boot/efi/EFI/BOOT/BOOTX64.EFI
# Regenerate initrd
dracut -f  --regenerate-all
# Update network script
rm -f /etc/sysconfig/network-scripts/ifcfg-eth0
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm -f /etc/hosts
dnf install -y network-scripts
restorecon -vR / >> /dev/null && echo 'restorecon success' || echo 'restorecon failed'