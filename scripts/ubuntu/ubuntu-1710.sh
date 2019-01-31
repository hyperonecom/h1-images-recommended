mkdir -p /run/systemd/resolve/
echo 'nameserver 9.9.9.9' > /run/systemd/resolve/stub-resolv.conf
echo 'nameserver 8.8.8.8' >> /run/systemd/resolve/stub-resolv.conf
export DEBIAN_FRONTEND=noninteractive; apt-get update && apt-get -y dist-upgrade
apt-get -y install  debconf-utils vim resolvconf arping curl lsb-core ifupdown
export DEBIAN_FRONTEND=noninteractive; apt-get -y purge extlinux
echo 'grub-pc grub-pc/install_devices string /dev/sdb' | debconf-set-selections
export DEBIAN_FRONTEND=noninteractive; apt-get -y install  grub2
apt-get clean
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub 
rm /etc/default/grub.d/40-force-partuuid.cfg
grub-mkconfig -o /boot/grub/grub.cfg
grub-install /dev/sdb
export DEBIAN_FRONTEND=noninteractive; apt-get install -y --reinstall grub-efi
grub-install --removable --target=x86_64-efi /dev/sdb
update-grub
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
update-initramfs -u
systemctl set-default multi-user
(echo 'source-directory interfaces.d'; echo 'source interfaces.d/*.cfg') > /etc/network/interfaces
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm /etc/hosts
echo "net.ipv4.conf.all.arp_notify = 1" >> /etc/sysctl.d/gratuitous-arp.conf
echo "net.ipv4.conf.default.arp_notify = 1" >> /etc/sysctl.d/gratuitous-arp.conf