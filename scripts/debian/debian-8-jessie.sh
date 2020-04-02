#!/bin/sh
set -eux
df -P .
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )
mkdir -p /run/resolvconf
export DEBIAN_FRONTEND=noninteractive; 
echo 'nameserver 9.9.9.9' > /etc/resolv.conf
echo 'nameserver 8.8.8.8' >> /etc/resolv.conf

apt-get update && apt-get -y dist-upgrade
apt-get -y install debconf-utils vim resolvconf arping curl gdisk
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
echo 'interface ignore wildcard' >> /etc/ntp.conf
(echo 'source-directory interfaces.d'; echo 'source interfaces.d/*.cfg') > /etc/network/interfaces
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf

# Debian 8 is almost EOL, so repository system is not well-maintaned
rm /etc/cloud/cloud.cfg /etc/cloud/cloud.cfg.d/ -r
wget http://archive.debian.org/debian/pool/main/c/cloud-init/cloud-init_0.7.7~bzr1156-1~bpo8+1_all.deb -O /tmp/cloduinit.deb
wget http://archive.debian.org/debian/pool/main/c/cloud-utils/cloud-guest-utils_0.29-1~bpo8+1_all.deb -O /tmp/cloud-guest-utils.deb
wget http://archive.debian.org/debian/pool/main/c/cloud-utils/cloud-utils_0.29-1~bpo8+1_all.deb -O /tmp/cloud-utils.deb
wget http://archive.debian.org/debian/pool/main/c/cdrkit/genisoimage_1.1.11-3_amd64.deb -O /tmp/geniso.deb
wget http://archive.debian.org/debian/pool/main/liba/libaio/libaio1_0.3.110-1_amd64.deb -O /tmp/libaio.deb
wget http://archive.debian.org/debian/pool/main/c/cloud-utils/cloud-image-utils_0.29-1~bpo8+1_all.deb -o /tmp/cloud-image-utils.deb
dpkg --force-confnew -i /tmp/*.deb || apt-get -o Dpkg::Options::=--force-confnew  -f install -f -y
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
echo 'network: {config: disabled}' > /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
rm /etc/hosts
sync;