#!/bin/node
'use strict';
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const readDir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const { join } = require('path');
const yaml = require('js-yaml');
const { qcow } = require('./lib/naming');

const getter = (config, key) => config[key] && config[key].h1 ? config[key].h1 : config[key];

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
    const post_mount_commands = [
        'mkdir -p {{.MountPath}}/boot/efi',
        'mount -t vfat {{.Device}}1 {{.MountPath}}/boot/efi',
        'wget -nv {{user `download_url`}} -O {{user `download_path`}}',
        'mkdir {{user `mount_qcow_path`}}',
        'LIBGUESTFS_BACKEND=direct guestmount -a {{user `download_path`}} -m {{user `qcow_part`}} --ro {{user `mount_qcow_path`}}',
        'setenforce 0',
    ];
    if (getter(config, 'selinux') === '1') {
        post_mount_commands.push(
            'rsync -aH -X --inplace -W --numeric-ids -A {{user `mount_qcow_path`}}/ {{.MountPath}}/ --info=progress2'
        );
    } else {
        post_mount_commands.push(
            'rsync -aH --inplace -W --numeric-ids -A {{user `mount_qcow_path`}}/ {{.MountPath}}/ --info=progress2'
        );
    }

    return {
        variables: {
            source_image: getter(config, 'source_image') || 'fedora:32',
            download_path: '/home/guru/image-{{timestamp}}.qcow',
            mount_qcow_path: '/home/guru/qcow-{{timestamp}}',
            download_url: getter(config, 'download_url'),
            qcow_part: getter(config, 'qcow_part'),
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
            public_netadp_service: 'public',
            vm_type: 'a1.small',
            repository: 'https://packages.hyperone.cloud',
            cli_package: 'h1-cli',
            scope_name: 'HyperOne',
            state_timeout: '10m',
        },
        builders: [
            {
                type: 'hyperone',
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
                public_netadp_service: '{{user `public_netadp_service`}}',
                state_timeout: '{{user `state_timeout`}}',
                pre_mount_commands: [
                    "[ ! -e '/etc/rpm/macros.dist' ] || sudo yum install -y \"https://dl.fedoraproject.org/pub/epel/epel-release-latest-$(awk '/rhel/ {print $2}' /etc/rpm/macros.dist).noarch.rpm\"",
                    'yum install -y --setopt=skip_missing_names_on_install=False mtools libgcrypt libguestfs-tools dosfstools libguestfs-xfs wget',
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
    const path = './config/packer';
    const files = await readDir(path);
    for (const file of files.filter(x => x.endsWith('.yaml'))) {
        const input_content = await readFile(join(path, file));
        const config = yaml.safeLoad(input_content);
        if (config.format !== 'qcow') {
            continue;
        }
        const template = render_templates(config);
        const output_content = JSON.stringify(template, null, 4);
        await writeFile(join('./templates/qcow', `${qcow(config)}`), output_content);
    }
};
main().then(console.log).catch(console.error);
