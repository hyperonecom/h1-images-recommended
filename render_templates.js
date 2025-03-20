#!/bin/node
'use strict';
const fs = require('fs');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);
const { listConfig } = require('./lib/config');

const getter = (config, key) => config[key] && config[key].h1 ? config[key].h1 : config[key];

const DEFAULTS = {
    download_path: '/home/guru/image-tmpfs/image.qcow',
    image_mount_path: '/home/guru/mnt-image',
};

const render_templates = config => {
    const chroot_mounts = [
        ['proc', 'proc', '/proc'],
        ['sysfs', 'sysfs', '/sys'],
        ['bind', '/dev', '/dev'],
        ['devpts', 'devpts', '/dev/pts'],
        ['binfmt_misc', 'binfmt_misc', '/proc/sys/fs/binfmt_misc'],
    ];
    if (config.selinux === '1') {
        // Extra selinuxfs for SELinux & 'fixfiles' command
        chroot_mounts.push(['selinuxfs', 'none', '/sys/fs/selinux']);
    }

    const tags = {
        arch: getter(config, 'arch'),
        distro: getter(config, 'distro'),
        release: getter(config, 'version'),
        edition: getter(config, 'edition'),
        codename: getter(config, 'codename'),
        recommended: { disk: { size: 20 } },
    };

    // source:
    // url: 'https://cloud-images.ubuntu.com/releases/oracular/release/ubuntu-24.10-server-cloudimg-amd64.img'
    // type: qcow
    // mount:
    //   root: p1
    //   boot: p13

    const rsync = (path = DEFAULTS.image_mount_path) => {
        const rsync_opts = getter(config, 'selinux') === '1' ? '-X' : '';
        return [
            'setenforce 0',
            `rsync -aH ${rsync_opts} --inplace -W --numeric-ids -A -v ${path}/ {{.MountPath}}/ | pv -l -c -n -i 30 -t >/dev/null`,
        ];
    };

    let source = getter(config, 'source');
    let qcow_mount = [];
    if (source) {
        // applying defaults that if present in source will be overwritten by source
        const SOURCE_DEFAULTS = {
            type: 'qcow',
            mount: {
                path: DEFAULTS.image_mount_path,
                root: 'p1',
            },
        };
        source = {
            ...SOURCE_DEFAULTS,
            ...source,
            mount: {
                ...SOURCE_DEFAULTS.mount,
                ...source.mount,
            },
        };
        let qcow_unmount = [];
        qcow_mount = [
            ...qcow_mount,
            'modprobe nbd',
            `qemu-nbd -c /dev/nbd0 ${DEFAULTS.download_path}`,
            'partprobe /dev/nbd0',
            `mkdir -p ${DEFAULTS.image_mount_path}`,
            `mount /dev/nbd0${source.mount.root} ${DEFAULTS.image_mount_path}`,
        ];
        if (source.mount.boot) {
            qcow_mount = [
                ...qcow_mount,
                `mount /dev/nbd0${source.mount.boot} ${DEFAULTS.image_mount_path}/boot`,
            ];
            qcow_unmount = [
                ...qcow_unmount,
                `umount ${DEFAULTS.image_mount_path}/boot`,
            ];
        }
        qcow_mount = [
            ...qcow_mount,
            ...rsync(DEFAULTS.image_mount_path),
            ...qcow_unmount,
            `umount ${DEFAULTS.image_mount_path}`,
            'qemu-nbd -d /dev/nbd0',
        ];
    } else {
        const qcow_boot_part = getter(config, 'qcow_boot_part');
        qcow_mount = qcow_boot_part ? [
            ...qcow_mount,
            'LIBGUESTFS_BACKEND=direct guestmount -a {{user `download_path`}} -m {{user `qcow_part`}} --ro {{user `mount_qcow_path`}}',
            'LIBGUESTFS_BACKEND=direct guestmount -a {{user `download_path`}} -m {{user `qcow_boot_part`}} --ro {{user `mount_qcow_path`}}/boot',
            ...rsync(),
        ] : [
            ...qcow_mount,
            'LIBGUESTFS_BACKEND=direct guestmount -a {{user `download_path`}} -m {{user `qcow_part`}} --ro {{user `mount_qcow_path`}}',
            ...rsync(),
        ];
    }

    const download_url = source ? source.url : getter(config, 'download_url');

    const post_mount_commands = [
        'mkdir -p {{.MountPath}}/boot/efi',
        'mount -t vfat {{.Device}}1 {{.MountPath}}/boot/efi',
        'mkdir /home/guru/image-tmpfs',
        'mount -t tmpfs -o size=1g tmpfs /home/guru/image-tmpfs',
        `wget -nv ${download_url} -O ${DEFAULTS.download_path}`,
        `mkdir ${DEFAULTS.image_mount_path}`,
        ...qcow_mount,
        'umount /home/guru/image-tmpfs',
    ];

    const console_on_tty1 = [
        'mkdir -p /etc/systemd/system/getty@tty1.service.d/',
        'echo "[Service]" | sudo tee /etc/systemd/system/getty@tty1.service.d/override.conf',
        'echo "ExecStart=" | sudo tee -a /etc/systemd/system/getty@tty1.service.d/override.conf',
        'echo "ExecStart=-/sbin/agetty --autologin root --noclear %I \$TERM" | sudo tee -a /etc/systemd/system/getty@tty1.service.d/override.conf',
        'echo "Type=idle" | sudo tee -a /etc/systemd/system/getty@tty1.service.d/override.conf',
        'systemctl daemon-reload',
        'systemctl restart getty@tty1.service',
    ];

    return {
        variables: {
            source_image: getter(config, 'source_image') || 'fedora:32',
            download_path: `${DEFAULTS.download_path}`,
            mount_qcow_path: `${DEFAULTS.image_mount_path}`,
            qcow_part: getter(config, 'qcow_part'),
            qcow_boot_part: getter(config, 'qcow_boot_part'),
            root_fs: getter(config, 'root_fs') || 'ext4',
            root_fs_opts: '-E lazy_itable_init=1',
            scripts: getter(config, 'custom_scripts').join(','),
            ...getter(config, 'cloud_init_install') ? {
                cloud_init_tmp_path: '/tmp/cloud_init.py',
                cloud_init_ds_src: getter(config, 'cloud_init_ds_src') || './resources/cloud-init/ds_v2/DataSourceRbxCloud.py',
            } : {},
            disk_size: getter(config, 'disk_size') || '10',
            image_name: getter(config, 'pname'),
            ssh_name: 'my-ssh',
            image_description: JSON.stringify(tags),
            network: 'public',
            vm_type: 'a1.small',
            repository: 'https://packages.hyperone.cloud',
            cli_package: 'h1-cli',
            scope_name: 'HyperOne',
            state_timeout: '10m',
        },
        builders: [
            {
                type: 'hyperone',
                project: '{{user `project`}}',
                network: '{{user `network`}}',
                disk_size: 10,
                chroot_disk: true,
                mount_partition: 4,
                vm_name: `packer-${getter(config, 'name')}`,
                source_image: '{{user `source_image`}}',
                vm_type: '{{user `vm_type`}}',
                ssh_keys: '{{user `ssh_name`}}',
                chroot_command_wrapper: 'sudo {{.Command}}',
                chroot_disk_size: '{{user `disk_size`}}',
                image_name: '{{user `image_name`}}',
                image_description: '{{user `image_description`}}',
                state_timeout: '{{user `state_timeout`}}',
                pre_mount_commands: [
                    ...console_on_tty1,
                    "[ ! -e '/etc/rpm/macros.dist' ] || sudo yum install -y \"https://dl.fedoraproject.org/pub/epel/epel-release-latest-$(awk '/rhel/ {print $2}' /etc/rpm/macros.dist).noarch.rpm\"",
                    'yum install -y --setopt=skip_missing_names_on_install=False mtools libgcrypt dosfstools wget pv qemu-img',
                    'modprobe kvm',
                    'sgdisk -Z {{.Device}}',
                    'sgdisk -n 1:0:+50MB -t 1:EF01 -c 1:EFI {{.Device}}',
                    'sgdisk -n 2:0:+50MB -t 2:0700 -c 2:CLOUDMD {{.Device}}',
                    'sgdisk -n 3:0:+1MB  -t 3:EF02 -c 3:BIOS {{.Device}}',
                    'sgdisk -n 4:0:-0    -t 4:8300 -c 4:ROOT {{.Device}} -A 4:set:2',
                    'gdisk -l {{.Device}}',
                    'sleep 2',
                    'mkfs.fat {{.Device}}1 -n EFI',
                    'mkfs.fat {{.Device}}2 -n CLOUDMD',
                    'mkfs.{{user `root_fs`}} {{user `root_fs_opts`}} {{.Device}}4',
                ],
                chroot_mounts,
                post_mount_commands,
            },
        ],
        provisioners: [
            {
                type: 'shell',
                scripts: '{{user `scripts`}}',
                environment_vars: [
                    'SCOPE_NAME={{user `scope_name`}}',
                    'REPOSITORY={{user `repository`}}',
                    'CLI_PACKAGE={{user `cli_package`}}',
                ],
            },
            ...getter(config, 'cloud_init_install') ? [
                {
                    type: 'file',
                    source: '{{user `cloud_init_ds_src`}}',
                    destination: '{{user `cloud_init_tmp_path`}}',
                },
                {
                    type: 'shell',
                    inline: [
                        'CLOUD_INIT_DS_DIR=$(find /usr -name cloudinit -type d)',
                        'echo Found cloud-init in path: ${CLOUD_INIT_DS_DIR}',
                        'mv {{user `cloud_init_tmp_path`}} ${CLOUD_INIT_DS_DIR}/sources/DataSourceRbxCloud.py',
                    ],
                },
            ] : [],
        ],
    };
};


const main = async () => {
    for (const imageConfig of await listConfig(['packer'])) {
        if (imageConfig.format !== 'qcow') {
            console.log(`Invalid format: ${imageConfig.pname}`);
            continue;
        }
        console.log(`Rendering: ${imageConfig.pname}`);
        const template = render_templates(imageConfig);
        const output_content = JSON.stringify(template, null, 4);
        await writeFile(imageConfig.template_file, output_content);
    }
};
main().catch(console.error);
