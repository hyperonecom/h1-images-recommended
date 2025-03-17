#!/bin/sh
set -eux

# removing because it was on separate partition in the image
rmdir "/boot/lost+found" || true

DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )

export DEBIAN_FRONTEND=noninteractive; 
# apt-get update && apt-get -y upgrade && apt-get -y dist-upgrade
apt-get update && apt-get -y dist-upgrade
apt-get -y install debconf-utils vim arping curl ifupdown

# BOOTLOADER
# no need to install any packages, like grub-cloud-amd64, because it's already installed in the image
apt-get -y purge extlinux # remove extlinux that contains other bootloaders (not grub)
echo "grub-pc grub-pc/install_devices string $DEVICE_DISK" | debconf-set-selections
echo "grub-efi-amd64 grub2/force_efi_extra_removable boolean true" | debconf-set-selections
touch /etc/grub.d/enable_cloud
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub
echo "GRUB_DISABLE_OS_PROBER=true" >> /etc/default/grub
# Ubuntu >=19.10 force partuuid
# Ubuntu < 19.10 doesn't have that file
[ -f "/etc/default/grub.d/40-force-partuuid.cfg" ] && rm /etc/default/grub.d/40-force-partuuid.cfg
grub-install --recheck --no-floppy ${DEVICE_DISK} # installs grub to MBR
# IMPROTANT: UEFI bootloader on Ubuntu requires --bootloader-id to be set to "ubuntu" otherwise it will start grub console on boot but not load OS
grub-install --target=x86_64-efi --efi-directory=/boot/efi --bootloader-id=ubuntu # installs grub to EFI in /boot/efi/EFI/ubuntu
grub-install --target=x86_64-efi --efi-directory=/boot/efi --removable # installs grub to EFI fallback directory /boot/eft/EFI/BOOT
grub-mkconfig -o /boot/grub/grub.cfg # update-grub is a wrapper for grub-mkconfig

# blacklisting floppy
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
update-initramfs -u

systemctl set-default multi-user
(echo 'source-directory interfaces.d'; echo 'source interfaces.d/*.cfg') > /etc/network/interfaces
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm /etc/hosts

# Configure chrony
apt-get -y install chrony
echo 'refclock PHC /dev/ptp0 poll 3 dpoll -2 offset 0' >> /etc/chrony/chrony.conf
sync