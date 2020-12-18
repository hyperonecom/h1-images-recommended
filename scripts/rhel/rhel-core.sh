#!/bin/bash
set -eux
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )

# Access RHUI
. /etc/os-release
curl "http://${REDHAT_SECRET}@5e704ae4d9fe4b5b0d13a090.website.pl-waw-1.hyperone.cloud/${RHUI_CLIENT}" -o "/tmp/rhui-client.rpm"
rpm -i "/tmp/rhui-client.rpm";

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
# Update fs elevator and set console tty
sed -i 's/^GRUB_CMDLINE_LINUX=.*$/GRUB_CMDLINE_LINUX="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"/' /etc/default/grub
# Update grub configuration
grub2-mkconfig -o "/boot/grub2/grub.cfg"
grub2-mkconfig -o "/boot/efi/EFI/BOOT/grub.cfg"
sed -i 's/linux16/linuxefi/' /boot/efi/EFI/*/grub.cfg
sed -i 's/initrd16/initrdefi/' /boot/efi/EFI/*/grub.cfg

# Install update
yum update -y

# Add required packages
yum install -y firewalld
sudo systemctl enable firewalld

# Remove extra packages
yum remove -y ovirt-guest-agent qemu-guest-agent microcode_ctl

# Install Cloud-init
yum install -y cloud-init cloud-utils-growpart wget gdisk

CLOUD_INIT_DS_DIR=$(find /usr -name cloudinit -type d)
echo "Found cloud-init in path: ${CLOUD_INIT_DS_DIR}"
wget -O "${CLOUD_INIT_DS_DIR}/sources/DataSourceRbxCloud.py" https://raw.githubusercontent.com/canonical/cloud-init/20.2/cloudinit/sources/DataSourceRbxCloud.py
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
# Remove /etc/host to manage by cloud-init
rm -f /etc/hosts

# Configure chrony
yum -y install chrony
echo 'refclock PHC /dev/ptp0 poll 3 dpoll -2 offset 0' >> /etc/chrony.conf

restorecon -vR / >> /dev/null && echo 'restorecon success' || echo 'restorecon failed'