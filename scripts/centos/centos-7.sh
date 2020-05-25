#!/bin/sh
set -eux
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )
fixfiles onboot
fixfiles -F -f relabel

echo 'nameserver 9.9.9.9' > /etc/resolv.conf
echo 'nameserver 8.8.8.8' >> /etc/resolv.conf

yum -y update
yum -y install vim curl redhat-lsb-core gdisk
# CentOS 8 have arping preinstalled
arping -V || yum -y install arping
yum clean all
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
echo 'omit_drivers+="floppy"' > /etc/dracut.conf.d/nofloppy.conf
dracut -f  --regenerate-all

# Update grub config
echo 'GRUB_DISABLE_OS_PROBER=true' >> /etc/default/grub
yum -y install grub2-efi-x64 shim-x64 grub2-efi-x64-modules
grub2-install "${DEVICE_DISK}"
grub2-install --removable --target=x86_64-efi "${DEVICE_DISK}"
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub
grub2-set-default 0
grub2-mkconfig -o /boot/grub2/grub.cfg
sed -i 's/linux16/linuxefi/' /boot/grub2/grub.cfg
sed -i 's/initrd16/initrdefi/' /boot/grub2/grub.cfg
rm -f /boot/efi/EFI/centos/grub.cfg
cp /boot/grub2/grub.cfg /boot/efi/EFI/centos/grub.cfg

# Configure network
rm -f /etc/sysconfig/network-scripts/ifcfg-eth0
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm -f /etc/hosts
