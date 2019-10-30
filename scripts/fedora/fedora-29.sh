#!/bin/sh
fixfiles onboot
fixfiles -F -f relabel
echo 'nameserver 9.9.9.9' > /etc/resolv.conf
echo 'nameserver 8.8.8.8' >> /etc/resolv.conf
yum -y update
yum -y install vim curl redhat-lsb-core 
yum clean all
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
echo "net.ipv4.conf.all.arp_notify = 1" >> /etc/sysctl.d/gratuitous-arp.conf
echo "net.ipv4.conf.default.arp_notify = 1" >> /etc/sysctl.d/gratuitous-arp.conf
fixfiles onboot
fixfiles -F -f relabel
# Update cloud-init version to 18.5
# See:
# - https://bugzilla.redhat.com/show_bug.cgi?id=1661441
# - https://git.launchpad.net/cloud-init/commit/?id=3861102fcaf47a882516d8b6daab518308eb3086
# - https://src.fedoraproject.org/rpms/cloud-init/pull-request/3
#curl http://cdn.files.jawne.info.pl/private_html/2019_03_ai7iephohzuph5bai1kefuwap2iequisheengungooCieD6loh/cloud-init-18.5-1.fc29.noarch.rpm -o /tmp/cloud-init-18.5-1.fc29.noarch.rpm
#yum localinstall -y /tmp/cloud-init-18.5-1.fc29.noarch.rpm
yum install -y network-scripts
