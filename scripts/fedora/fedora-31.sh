fixfiles onboot
echo 'nameserver 9.9.9.9' > /etc/resolv.conf
echo 'nameserver 8.8.8.8' >> /etc/resolv.conf
dnf -y update
dnf -y install vim curl redhat-lsb-core nano
dnf clean all
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
echo 'omit_drivers+="floppy"' > /etc/dracut.conf.d/nofloppy.conf
dracut -f  --regenerate-all
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub 
grub2-mkconfig -o /boot/grub2/grub.cfg
grub2-set-default 0
grub2-install /dev/sdb
grub2-mkconfig -o /boot/efi/EFI/fedora/grub.cfg
# Install Grub for UEFI
mkdir -p  /boot/efi/EFI/BOOT
yum -y install grub2-efi-x64 shim-x64
rm -f /boot/efi/EFI/BOOT/BOOTX64.EFI
cp /boot/efi/EFI/fedora/grubx64.efi /boot/efi/EFI/BOOT/BOOTX64.EFI
# Update network script
rm -f /etc/sysconfig/network-scripts/ifcfg-eth0
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm -f /etc/hosts
dnf install -y network-scripts
fixfiles -F -f relabel
