#!/bin/node
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const readDir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const {join} = require('path');
const yaml = require('js-yaml');
const {qcow} = require('./lib/naming');

const render_templates = config => {
    const chroot_mounts = [
        ["proc", "proc", "/proc"],
        ["sysfs", "sysfs", "/sys"],
        ["bind", "/dev", "/dev"],
        ["devpts", "devpts", "/dev/pts"],
        ["binfmt_misc", "binfmt_misc", "/proc/sys/fs/binfmt_misc"],
    ];
    if (config.selinux === '1') {
        // Extra selinuxfs for SELinux & 'fixfiles' command
        chroot_mounts.push(["selinuxfs", "none", "/sys/fs/selinux"]);
    }
    const tags = {
        "arch": config.arch,
        "distro": config.distro,
        "release": config.version,
        "edition": config.edition,
        "codename": config.codename,
        "recommended": {"disk": {"size": 20}}
    };
    const post_mount_commands = [
                    "mkdir -p {{.MountPath}}/boot/efi",
                    "mount -t vfat {{.Device}}1 {{.MountPath}}/boot/efi",
                    "wget -nv {{user `download_url`}} -O {{user `download_path`}}",
                    "mkdir {{user `mount_qcow_path`}}",
                    "LIBGUESTFS_BACKEND=direct guestmount -a {{user `download_path`}} -m {{user `qcow_part`}} {{user `mount_qcow_path`}}",
                ] ;
    if(config.selinux === '1' ){
        post_mount_commands.push(
            "rsync -aH -X --inplace -W --numeric-ids -A -v {{user `mount_qcow_path`}}/ {{.MountPath}}/ | pv -l -c -n >/dev/null"
        );
    }else{
        post_mount_commands.push(
            "rsync -aH --inplace -W --numeric-ids -A -v {{user `mount_qcow_path`}}/ {{.MountPath}}/ | pv -l -c -n >/dev/null"
        )
    }
    return {
        variables: {
            source_image: "image-builder-fedora",
            download_path: "/home/guru/image-{{timestamp}}.qcow",
            mount_qcow_path: "/home/guru/qcow-{{timestamp}}",
            cloud_init_tmp_path: "/tmp/cloud_init.py",
            download_url: config.download_url,
            qcow_part: config.qcow_part,
            img_fs: config.img_fs || "ext4",
            scripts: config.custom_scripts.join(","),
            cloud_init_ds_dir: config.cloud_init_ds_dir,
            cloud_init_ds_src: config.cloud_init_ds_src || './resources/cloud-init/ds/DataSourceRbxCloud.py',
            // disk_size: config.disk_size || 10,
            disk_size: config.disk_size || "10",
            image_name: config.pname,
            ssh_name: 'my-ssh',
            image_description: JSON.stringify(tags),
            public_netadp_service: "public",
            vm_type: 'a1.small',
            repository: 'https://packages.hyperone.cloud',
            cli_package: 'h1-cli',
            scope_name: 'HyperOne'
        },
        builders: [
            {
                type: "hyperone",
                disk_size: 10,
                chroot_disk: true,
                mount_partition: 3,
                vm_name: `packer-${config.name}`,
                source_image: "{{user `source_image`}}",
                vm_type: "{{user `vm_type`}}",
                ssh_keys: '{{user `ssh_name`}}',
                chroot_command_wrapper: "sudo {{.Command}}",
                chroot_disk_size: "{{user `disk_size`}}",
                image_name: "{{user `image_name`}}",
                image_description: "{{user `image_description`}}",
                public_netadp_service: "{{user `public_netadp_service`}}",
                pre_mount_commands: [
                    "sfdisk -uS --force \"{{.Device}}\" <<END\n2048,102400,ef\n104448,102400,b\n206848,,L,*\nEND",
                    "partprobe", "sleep 1", "partprobe",
                    "mkfs.fat {{.Device}}1",
                    "mkfs.fat {{.Device}}2",
                    "mkfs.{{user `img_fs`}} {{.Device}}3",
                    "dosfslabel {{.Device}}1 EFI",
                    "dosfslabel {{.Device}}2 CLOUDMD",
                ],
                chroot_mounts,
                post_mount_commands
            }
        ],
        provisioners: [
            {
                type: "shell",
                inline: [
                    "DISK_UUID=$(blkid -s UUID -o value /dev/sdb3)",
                    "echo \"UUID=$DISK_UUID    /    ext4    defaults    1    1\" > /etc/fstab"
                ]
            },
            {
                type: "file",
                source: "{{user `cloud_init_ds_src`}}",
                destination: "{{user `cloud_init_tmp_path`}}"
            },
            {
                type: "shell",
                inline: [
                    "mv {{user `cloud_init_tmp_path`}} {{user `cloud_init_ds_dir`}}/DataSourceRbxCloud.py"
                ]
            },
            {
                type: "shell",
                scripts: "{{user `scripts`}}",
                environment_vars: [
                    "SCOPE_NAME={{user `scope_name`}}",
                    "REPOSITORY={{user `repository`}}",
                    "CLI_PACKAGE={{user `cli_package`}}",
                ]
            }
        ]
    }
};


const main = async () => {
    const path = './config/packer';
    const files = await readDir(path);
    for (const file of files.filter(x => x.endsWith('.yaml'))) {
        const input_content = await readFile(join(path, file));
        const config = yaml.safeLoad(input_content);
        if(config.format !== 'qcow'){
            continue;
        }
        const template = render_templates(config);
        const output_content = JSON.stringify(template, null, 4);
        await writeFile(join('./templates/qcow', `${qcow(config)}`), output_content);
    }
};
main().then(console.log).catch(console.error);
