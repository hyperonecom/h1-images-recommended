#!/bin/sh
set -eux;
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )
export DEBIAN_FRONTEND=noninteractive; 
apt-get update && apt-get -y dist-upgrade
apt-get -y install debconf-utils vim resolvconf arping curl
# Install grub
echo "grub-pc grub-pc/install_devices string ${DEVICE_DISK}" | debconf-set-selections
echo "grub-efi-amd64 grub2/force_efi_extra_removable boolean true" | debconf-set-selections
touch /etc/grub.d/enable_cloud
apt-get -y -o Dpkg::Options::=--force-confnew install grub-cloud-amd64
# Update grub configuration
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub
update-grub
# Update initrd
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
update-initramfs -u -k all
systemctl set-default multi-user
echo 'interface ignore wildcard' >> /etc/ntp.conf
(echo 'source-directory interfaces.d'; echo 'source interfaces.d/*.cfg') > /etc/network/interfaces
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm /etc/hosts