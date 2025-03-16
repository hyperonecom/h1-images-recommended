#!/bin/sh

# udev rules to set block device scheduler as "none", Hyper-V disks are detected by Linux as rotational
# Linux kernel detects if scsi block devices are rotational based on VPD page 0xb1
#   sg_inq --vpd --page=0xb1 /dev/sda   # requires sg3-utils .deb package
#   udevadm info --attribute-walk --name=sda

cat <<EOT > /etc/udev/rules.d/60-h1-ioschedulers.rules
ACTION=="add|change", KERNEL=="sd[a-z]*", ATTR{queue/scheduler}="none"
EOT
