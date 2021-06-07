#!/bin/tcsh -fe
# Configure /etc/fstab for pivot_root successfully
echo "/dev/gpt/root / ufs rw,noatime 1 1" > /etc/fstab
# Setup 
echo 'sshd_enable="YES"' >> /etc/rc.conf
# Upgrade packages
setenv ASSUME_ALWAYS_YES yes
pkg update
pkg upgrade
# Install Cloud-init
pkg install -y net/cloud-init ca_root_nss arping
# Enable etc/hosts for FreeBSD
# See issue https://github.com/canonical/cloud-init/pull/479/files
sed -i -e "/update_hostname/a\\
 - update_etc_hosts\
" /usr/local/etc/cloud/cloud.cfg
# Install tools for testing image
pkg install -y curl bash
# Enables custom datasource for cloud-init
echo 'cloudinit_enable="YES"' >> /etc/rc.conf
set CLOUD_INIT_DS_DIR=`find /usr -name cloudinit -type d`
set CLOUD_INIT_REVISION='2730521fd566f855863c5ed049a1df26abcd0770'
cd "${CLOUD_INIT_DS_DIR}/sources";
fetch "https://raw.githubusercontent.com/canonical/cloud-init/${CLOUD_INIT_REVISION}/cloudinit/sources/DataSourceRbxCloud.py"
# python3.7 -c 'import cloudinit.sources.DataSourceRbxCloud' # verify successufll import
echo 'datasource_list: [ RbxCloud ]' > /usr/local/etc/cloud/cloud.cfg.d/90_dpkg.cfg
rm -rf /var/lib/cloud/data/
# Enables 'h1 vm serialport console' (tty & kernel log)
echo 'console="comconsole"' >> /boot/loader.conf
# Disable /etc/hosts to manage via cloud-init
cat /etc/rc.conf
rm /etc/hosts

# Make syslog listen on local only
sed -i -e 's/syslogd_flags=".*"/syslogd_flags="-s -b 127.0.0.1:syslog"/' /etc/defaults/rc.conf
