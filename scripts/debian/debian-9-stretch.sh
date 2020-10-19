#!/bin/sh
set -eux
df -P .
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )
export DEBIAN_FRONTEND=noninteractive; 

apt-get update && apt-get -y dist-upgrade
apt-get -y install debconf-utils vim resolvconf arping curl
echo "grub-pc grub-pc/install_devices string ${DEVICE_DISK}" | debconf-set-selections
echo "grub-efi-amd64 grub2/force_efi_extra_removable boolean true" | debconf-set-selections
apt-get install -y grub2-common grub-efi-amd64-bin grub-pc
grub-install --target=x86_64-efi --no-nvram --force-extra-removable
grub-install --target=i386-pc ${DEVICE_DISK}
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub;
update-grub
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
update-initramfs -u
systemctl set-default multi-user
userdel debian
rm -r /home/debian/
(echo 'source-directory interfaces.d'; echo 'source interfaces.d/*.cfg') > /etc/network/interfaces
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf

apt-get install cloud-utils
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm /etc/hosts
sync;