mkdir /run/resolvconf
echo 'nameserver 9.9.9.9' > /etc/resolv.conf
echo 'nameserver 8.8.8.8' >> /etc/resolv.conf
export DEBIAN_FRONTEND=noninteractive; apt-get update && apt-get -y dist-upgrade
apt-get -y install  debconf-utils vim resolvconf arping curl
export DEBIAN_FRONTEND=noninteractive; apt-get -y purge extlinux
echo 'grub-pc grub-pc/install_devices string /dev/sdb' | debconf-set-selections
export DEBIAN_FRONTEND=noninteractive; apt-get -y install  grub2
apt-get clean
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
sed -i 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*$/GRUB_CMDLINE_LINUX_DEFAULT="quiet"/' /etc/default/grub
grub-mkconfig -o /boot/grub/grub.cfg
grub-install /dev/sdb
export DEBIAN_FRONTEND=noninteractive; apt-get install -y --reinstall grub-efi
grub-install --removable --target=x86_64-efi /dev/sdb
update-grub
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
update-initramfs -u
systemctl set-default multi-user
echo 'interface ignore wildcard' >> /etc/ntp.conf
(echo 'source-directory interfaces.d'; echo 'source interfaces.d/*.cfg') > /etc/network/interfaces
sed -i 's/^ForwardToConsole=.*$/ForwardToConsole=no/' /etc/systemd/journald.conf
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
echo 'network: {config: disabled}' > /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
rm /etc/hosts
