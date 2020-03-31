#!/bin/sh
set -eux
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )

# Setup DNS for chroot
mkdir -p /run/resolvconf
echo 'nameserver 9.9.9.9' > /run/resolvconf/resolv.conf
echo 'nameserver 8.8.8.8' >> /run/resolvconf/resolv.conf
echo '62.181.8.127 rhui.pl-waw-1.hyperone.cloud'  | tee -a /etc/hosts

# Access RHUI
. /etc/os-release
curl "http://travis:${REDHAT_SECRET}@5e704ae4d9fe4b5b0d13a090.website.pl-waw-1.hyperone.cloud/rhel-server-${VERSION_ID}.rpm" -o "rhel-server-${VERSION_ID}.rpm"
rpm -i "rhel-server-${VERSION_ID}.rpm";

# Install GRUB
grub2-install ${DEVICE_DISK}

# Install Grub for UEFI
yum install -y grub2-efi-x64
cp -r /boot/efi/EFI/redhat/ /boot/efi/EFI/BOOT/
cp /boot/efi/EFI/redhat/grubx64.efi /boot/efi/EFI/BOOT/bootaa64.efi

# Update initamfs config
dracut -f --regenerate-all

# Updat grub config
echo 'GRUB_DISABLE_OS_PROBER=true' >> /etc/default/grub
grub2-mkconfig -o "/boot/grub2/grub.cfg"
grub2-mkconfig -o "/boot/efi/EFI/BOOT/grub.cfg"
sed -i 's/linux16/linuxefi/' /boot/efi/EFI/*/grub.cfg
sed -i 's/initrd16/initrdefi/' /boot/efi/EFI/*/grub.cfg

# Add required packages
yum install -y firewalld
sudo systemctl enable firewalld

# Remove extra packages
yum remove -y ovirt-guest-agent qemu-guest-agent microcode_ctl

# Install Cloud-init
yum install -y cloud-init cloud-utils-growpart wget gdisk
yum clean all

CLOUD_INIT_DS_DIR=$(find /usr -name cloudinit -type d)
echo "Found cloud-init in path: ${CLOUD_INIT_DS_DIR}"
wget -O "${CLOUD_INIT_DS_DIR}/sources/DataSourceRbxCloud.py" https://raw.githubusercontent.com/canonical/cloud-init/master/cloudinit/sources/DataSourceRbxCloud.py
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
# Remove /etc/host to manage by cloud-init
rm -f /etc/hosts

# Fix SELinux
fixfiles onboot