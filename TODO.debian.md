# TODO - Debian

## Debian 12 

[x] - how to handle systemd-resolver and /etc/resolv.conf
        RESOLUTION: 
          * no using resolvconf package any more, fully relying on systemd-resolver
          * added script `./scripts/disble-llmr-mdns.sh` to configure systemd-resolver so LLMR and MDNS is disabled
          * cloud-init properly configures network, including dns resolving

[x] - new kernel returns on boot this warning:
        ```
        localhost kernel: Kernel parameter elevator= does not have any effect anymore.
        Please use sysfs to set IO scheduler for individual devices.
        ```
        RESOLUTION:
          * `noop` io scheduler for individual devices using udev rules, script: `./scripts/io_scheduler.sh`
          * removed "elevator=noop" from GRUB_CMDLINE_LINUX in `./scripts/debian/debian-12-bookworm.sh`

[ ] - investigate Debian 12 kernel warning:
        ```
        * Found PM-Timer Bug on the chipset. Due to workarounds for a bug,
        * this clock source is slow. Consider trying other clock sources
        ```

[ ] - upgrade h1-cli packages to v2



