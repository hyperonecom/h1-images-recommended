fixfiles onboot
fixfiles -F -f relabel
echo 'nameserver 9.9.9.9' > /etc/resolv.conf
echo 'nameserver 8.8.8.8' >> /etc/resolv.conf
yum -y update
yum -y install vim resolvconf arping curl redhat-lsb-core
yum clean all
ROOT_PART=$(blkid /dev/sdb3 -s UUID -o value) && grubby --update-kernel=ALL --args="ro root=UUID=$ROOT_PART consoleblank=0 elevator=noop rd_NO_LUKS rd_NO_LVM LANG=en_US.UTF-8 rd_NO_MD console=ttyS0,115200n8 crashkernel=auto SYSFONT=latarcyrheb-sun16  KEYBOARDTYPE=pc KEYTABLE=us rd_NO_DM"
sed -i 's/hd0,0/hd0,2/' /boot/grub/grub.conf
sed -i 's/vda1/sdb3/' /etc/mtab
sed -i 's/ext4/ext3/' /etc/mtab
grub-install /dev/sdb --recheck
echo -e "grub << EOF\ndevice (hd0) /dev/sdb\nroot (hd0,2)\nsetup (hd0)\nEOF" > /root/install_grub.sh
bash /root/install_grub.sh
rm -f /root/install_grub.sh
sed -i 's/vda1/sda3/' /etc/mtab
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
#KERN=$(rpm -q --queryformat '%{PROVIDEVERSION}' kernel) && dracut -f /boot/initramfs-${KERN}.x86_64.img ${KERN}.x86_65
rm -f /etc/sysconfig/network-scripts/ifcfg-eth0
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
echo 'network: {config: disabled}' > /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
rm -f /etc/hosts
