#!/bin/tcsh
# Configure /etc/fstab for pivot_root successfully
echo "/dev/gpt/root / ufs rw,noatime 1 1" > /etc/fstab
# Setup 
echo 'nameserver 8.8.8.8' > /etc/resolv.conf
echo 'sshd_enable="YES"' >> /etc/rc.conf
# Upgrade packages
export ASSUME_ALWAYS_YES=yes
pkg update
pkg upgrade
# Install Cloud-init
pkg install -y net/cloud-init ca_root_nss arping
# Enable etc/hosts for FreeBSD
# See issue https://github.com/canonical/cloud-init/pull/479/files
sed -i -e "/update_hostname/a\\
 - update_etc_hosts" /usr/local/etc/cloud/cloud.cfg
# Install tools for testing image
pkg install curl bash
# Enables custom datasource for cloud-init
echo 'cloudinit_enable="YES"' >> /etc/rc.conf
set CLOUD_INIT_DS_DIR=`find /usr -name cloudinit -type d`
set CLOUD_INIT_REVISION='c015ee4253f03b875e1b0fd5feac270810357199'
cd "${CLOUD_INIT_DS_DIR}/sources";
fetch "https://raw.githubusercontent.com/ad-m/cloud-init/${CLOUD_INIT_REVISION}/cloudinit/sources/DataSourceRbxCloud.py"
echo 'datasource_list: [ RbxCloud ]' > /usr/local/etc/cloud/cloud.cfg.d/90_dpkg.cfg
# Enables 'h1 vm serialport console' (tty & kernel log)
echo 'console="comconsole"' >> /boot/loader.conf
# Disable /etc/hosts to manage via cloud-init
cat /etc/rc.conf
rm /etc/hosts
