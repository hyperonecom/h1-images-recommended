#!/bin/sh
set -eux
echo '/dev/sda3    /    ext4    defaults    1    1' > /etc/fstab
echo 'nameserver 9.9.9.9' > /etc/resolv.conf
echo 'nameserver 8.8.8.8' > /etc/resolv.conf
echo "${MIRROR}/${REL}/main" > /etc/apk/repositories
echo "${MIRROR}/${REL}/community" >> /etc/apk/repositories
sed 's@default_kernel_opts=.*@default_kernel_opts="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"@' -i /etc/update-extlinux.conf
sed "s@modules=.*@modules=\"${MODULES}\"@" -i /etc/update-extlinux.conf
sed 's@root=.*@root=/dev/sda3@' -i /etc/update-extlinux.conf
sed 's@serial_baud=.*@serial_baud=115200@' -i /etc/update-extlinux.conf
cat /etc/update-extlinux.conf;
apk add "${LINUX_PACKAGE}"
sed -e 's;^#ttyS0;ttyS0;g' -i /etc/inittab
extlinux -i /boot
update-extlinux -v
apk --no-cache add --repository "${MIRROR}/edge/testing" cloud-init cloud-init-openrc
apk --no-cache add --repository "${MIRROR}/edge/testing" cloud-utils; # to provide growpart required by cloud-init
apk --no-cache add eudev; # to provide mdadm required by cloud-init
apk --no-cache add ifupdown; # to provide 'ip --all' required by cloud-init
apk --no-cache add iproute2; # to provide 'ip addr show permanent' required by cloud-init
apk --no-cache add openssh-server; # to provide ssh connectivity
apk --no-cache add openssh-sftp-server; # for Packer-provisionability
apk --no-cache add sudo; # to provide root access (users managed by cloud-init)
apk --no-cache add curl; # to provide InfluxDB metrics
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
apk -U add haveged && rc-update add haveged
sed '/after localmount/a    after haveged' -i /etc/init.d/cloud-init-local
dd bs=440 conv=notrunc count=1 if=/usr/share/syslinux/gptmbr.bin of=/dev/sdb;
sync;
cat /etc/init.d/cloud-init-local
rc-update -q add devfs sysinit
rc-update -q add dmesg sysinit
rc-update -q add mdev sysinit
rc-update -q add hwdrivers sysinit
rc-update -q add hwclock boot
rc-update -q add modules boot
rc-update -q add sysctl boot
rc-update -q add hostname boot
rc-update -q add bootmisc boot
rc-update -q add syslog boot
rc-update -q add networking boot
rc-update -q add urandom boot
rc-update -q add mount-ro shutdown
rc-update -q add killprocs shutdown
rc-update -q add savecache shutdown
rc-update -q add crond default
rc-update -q add sshd default
rc-update -q add cloud-config default
rc-update -q add cloud-final default
rc-update -q add cloud-init-local boot
rc-update -q add cloud-init default
rm -f /etc/hosts
# CLI installation
apk add --repository "http://dl-cdn.alpinelinux.org/alpine/edge/testing" h1-cli
# UEFI installation
mkdir -p /boot/efi/EFI/BOOT
cp /usr/lib/SYSLINUX.EFI/efi64/syslinux.efi* /boot/efi/EFI/BOOT/
cp /boot/extlinux.conf /boot/efi/EFI/BOOT/syslinux.cfg
sed -e 's@LINUX vmlinuz-virt@LINUX /vmlinuz-virt@' -e 's@INITRD initramfs-virt@INITRD /initramfs-virt@' /boot/efi/EFI/BOOT/syslinux.cfg -i
cp /boot/efi/EFI/BOOT/syslinux.efi /boot/efi/EFI/BOOT/BOOTX64.EFI
cp /boot/vmlinuz* /boot/efi/
cp /boot/initramfs* /boot/efi/
sync;
# Time synchronization
apk add chrony
echo 'refclock PHC /dev/ptp0 poll 3 dpoll -2 offset 0' >> /etc/chrony/chrony.conf
sudo rc-update -q add chronyd default
