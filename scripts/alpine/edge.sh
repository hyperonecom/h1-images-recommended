#!/bin/sh
set -eux
DEVICE=$(df -P . | awk 'END{print $1}')
DEVICE_DISK=$(echo $DEVICE | sed 's/[0-9]//g' )
echo "${MIRROR}/${REL}/main" > /etc/apk/repositories
echo "${MIRROR}/${REL}/community" >> /etc/apk/repositories
apk add "linux-virt"
sed -e 's;^#ttyS0;ttyS0;g' -i /etc/inittab
apk --no-cache add util-linux # to fix 'sfdisk'
# depends on 'ifupdown' to provide 'ip --all' required by cloud-init
# depends on 'iproute2' to provide 'ip addr show permanent' required by cloud-init
# depends on 'eudev' to provide mdadm required by cloud-init
# depends on 'arping' to provide valid version of arping
apk --no-cache iproute2 # on v3.13 move to 'iproute2-ss' to pass tests
apk --no-cache add arping # provide compatible version of arping for cloud-init
apk --no-cache add openssh-server # to provide ssh connectivity
apk --no-cache add openssh-sftp-server # for Packer-provisionability
apk --no-cache add sudo # to provide root access (users managed by cloud-init)
apk --no-cache add bash curl # to provide InfluxDB metrics
apk --no-cache add haveged # to provide entropy required by boot
apk --no-cache add eudev # to provide /dev/block for growpart of cloud-init
apk --no-cache add --repository "${MIRROR}/edge/testing" --repository "${MIRROR}/edge/main" --repository "${MIRROR}/edge/community" \
    cloud-init \
    cloud-init-openrc \
    cloud-utils-growpart;
sed '/after localmount/a    after haveged' -i /etc/init.d/cloud-init-local;
echo 'datasource_list: [ RbxCloud ]' > /etc/cloud/cloud.cfg.d/90_dpkg.cfg
rc-update -q add haveged
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
setup-udev -n # setup eudev
rm -f /etc/hosts
# CLI installation
apk add --repository "${MIRROR}/edge/testing" h1-cli
# Time synchronization
apk add chrony
echo 'refclock PHC /dev/ptp0 poll 3 dpoll -2 offset 0' >> /etc/chrony/chrony.conf
rc-update -q add chronyd default
# UEFI installation
sed 's@default_kernel_opts=.*@default_kernel_opts="elevator=noop consoleblank=0 console=tty0 console=ttyS0,115200n8"@' -i /etc/update-extlinux.conf
sed "s@modules=.*@modules=\"sd-mod,usb-storage,ext4\"@" -i /etc/update-extlinux.conf
sed "s@root=.*@root=/dev/sda4@" -i /etc/update-extlinux.conf
sed 's@serial_baud=.*@serial_baud=115200@' -i /etc/update-extlinux.conf
cat /etc/update-extlinux.conf;
extlinux -i /boot
update-extlinux -v
dd bs=440 conv=notrunc count=1 if=/usr/share/syslinux/gptmbr.bin of=${DEVICE_DISK};
dd bs=440 conv=notrunc count=1 if=${DEVICE_DISK} | xxd;
sync;
mkdir -p /boot/efi/EFI/BOOT
cp /usr/share/syslinux/efi64/* /boot/efi/EFI/BOOT/
cp /boot/extlinux.conf /boot/efi/EFI/BOOT/syslinux.cfg
sed -e 's@LINUX vmlinuz-virt@LINUX /vmlinuz-virt@' -e 's@INITRD initramfs-virt@INITRD /initramfs-virt@' /boot/efi/EFI/BOOT/syslinux.cfg -i
cp /boot/efi/EFI/BOOT/syslinux.efi /boot/efi/EFI/BOOT/BOOTX64.EFI
cp /boot/vmlinuz* /boot/efi/
cp /boot/initramfs* /boot/efi/
