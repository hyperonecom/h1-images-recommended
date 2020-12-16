#!/bin/sh
set -eux
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )

yum -y update
yum -y install vim curl redhat-lsb-core gdisk
# CentOS 8 have arping preinstalled
arping -V || yum -y install arping
yum clean all
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
echo 'omit_drivers+="floppy"' > /etc/dracut.conf.d/nofloppy.conf
dracut -f  --regenerate-all
# CentOS not use --crashkernel by default
systemctl disable kdump.service

# Update grub config
echo 'GRUB_DISABLE_OS_PROBER=true' >> /etc/default/grub
yum -y install grub2-efi-x64 shim-x64 grub2-efi-x64-modules
grub2-install "${DEVICE_DISK}"
grub2-install --removable --target=x86_64-efi "${DEVICE_DISK}"
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub
grub2-set-default 0
grub2-mkconfig -o /boot/grub2/grub.cfg
sed -i 's/linux16/linux/' /boot/grub2/grub.cfg
sed -i 's/initrd16/initrd/' /boot/grub2/grub.cfg
rm -f /boot/efi/EFI/centos/grub.cfg
cp /boot/grub2/grub.cfg /boot/efi/EFI/centos/grub.cfg

# Configure network
rm -f /etc/sysconfig/network-scripts/ifcfg-eth0
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm -f /etc/hosts
restorecon -vR / >> /dev/null && echo 'restorecon success' || echo 'restorecon failed'

# Configure chrony
yum -y install chrony
echo 'refclock PHC /dev/ptp0 poll 3 dpoll -2 offset 0' >> /etc/chrony/chrony.conf
