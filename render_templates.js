#!/bin/node
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const readDir = util.promisify(fs.readdir);
const writeFile = util.promisify(fs.writeFile);
const {join} = require('path');

const render_templates = config => ({
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
        disk_size: config.disk_size || 10,
        image_name: config.pname,
        ssh_name: 'my_ssh',
        image_description: JSON.stringify({
            arch: config.arch,
            distro: config.distro,
            release: config.version,
            edition: config.edition,
            codename: config.codename,
            recommended: {disk: {size: 20}}
        }),
    },
    builders: [
        {
            type: "hyperone",
            vm_name: "packer-5c530ff0-bd94-1870-8fcb-d695f1fe66b7",
            source_image: "{{user `source_image`}}",
            vm_type: "a1.medium",
            disk_size: 10,
            ssh_keys: '{{user `ssh_name`}}',
            chroot_disk: true,
            chroot_command_wrapper: "sudo {{.Command}}",
            chroot_disk_size: "{{user `disk_size`}}",
            image_name: "{{user `image_name`}}",
            image_description: "{{user `image_description`}}",
            pre_mount_commands: [
                "sfdisk -uS --force \"{{.Device}}\" <<END\n2048,102400,ef\n104448,102400,b\n206848,,L,*\nEND",
                "partprobe", "sleep 1", "partprobe",
                "mkfs.fat {{.Device}}1",
                "mkfs.fat {{.Device}}2",
                "mkfs.{{user `img_fs`}} {{.Device}}3",
                "dosfslabel {{.Device}}1 EFI",
                "dosfslabel {{.Device}}2 CLOUDMD",
            ],
            chroot_mount_path: "/tmp/mount",
            mount_partition: 3,
            post_mount_commands: [
                "mkdir -p {{.MountPath}}/boot/efi",
                "mount -t vfat {{.Device}}1 {{.MountPath}}/boot/efi",
                "wget -nv {{user `download_url`}} -O {{user `download_path`}}",
                "mkdir {{user `mount_qcow_path`}}",
                "LIBGUESTFS_BACKEND=direct guestmount -a {{user `download_path`}} -m {{user `qcow_part`}} {{user `mount_qcow_path`}}",
                "rsync -aH --inplace -W --numeric-ids -A {{user `mount_qcow_path`}}/ {{.MountPath}}/"
            ]
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
            scripts: "{{user `scripts`}}"
        }
    ]
});


const main = async () => {
    const path = './config/qcow';
    const files = await readDir(path);
    for (const file of files.filter(x => x.endsWith('.json'))) {
        const input_content = await readFile(join(path, file));
        const config = JSON.parse(input_content);
        const template = render_templates(config);
        const output_content = JSON.stringify(template, null, 4);
        await writeFile(join('./templates/qcow', file), output_content);
    }
};
main().then(console.log).catch(console.error);
