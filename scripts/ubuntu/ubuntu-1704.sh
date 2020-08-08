#!/bin/sh
set -eux
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )

export DEBIAN_FRONTEND=noninteractive; 
apt-get update && apt-get -y dist-upgrade
apt-get -y install  debconf-utils vim resolvconf arping curl lsb-core
apt-get -y purge extlinux
echo "grub-pc grub-pc/install_devices string $DEVICE_DISK" | debconf-set-selections
apt-get -y install  grub2
apt-get clean
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub 
grub-mkconfig -o /boot/grub/grub.cfg
grub-install "$DEVICE_DISK"
apt-get install -y --reinstall grub-efi
grub-install --removable --target=x86_64-efi "$DEVICE_DISK"
update-grub
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
update-initramfs -u
systemctl set-default multi-user
(echo 'source-directory interfaces.d'; echo 'source interfaces.d/*.cfg') > /etc/network/interfaces
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm /etc/hosts
