#!/usr/bin/env bats

function sshrun {
  ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "$@"
}

@test "ssh using key" {
  result="$(ssh -o StrictHostKeyChecking=no ${USER}@${IP} whoami)"
  [ "$?" -eq 0 ]
}

@test "ssh using password" {
skip
}

@test "check sudo works" {
  result=$(sshrun "sudo id")
  [ "$?" -eq 0 ]
  [[ "$result" =~ "root" ]]
}

@test "check /etc/hosts" {
  result=$(sshrun "sudo grep $HOSTNAME /etc/hosts |cut -f1 ")
  [ "$?" -eq 0 ]
  [[ "$result" =~ "127.0" ]]
}

@test "check grub consoleblank" {
  skip
  result=$(sshrun "grep 'consoleblank=0' /proc/cmdline")
  [ "$?" -eq 0 ]
}


# @test "check cloudinit done" {
#   result=$(sshrun "grep 'done' <(cloud-init status)")
#   [ "$?" -eq 0 ]
# }


# @test "check arping executed" {
#   result=$(sshrun "grep -E 'packets transmitted|Sent' /var/log/cloud-init*")
#   [ "$?" -eq 0 ]
# }


@test "check userdata available" {
  result=$(sshrun "cat /userdata")
  [ "$?" -eq 0 ]
}

@test "check grub console redirection" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  result=$(sshrun "grep 'console=ttyS0,115200n8' /proc/cmdline")
  [ "$?" -eq 0 ]
}


@test "check if fs mode is noop" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  result=$(ssh -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no ${USER}@${IP} "grep 'elevator=noop' /proc/cmdline")
  [ "$?" -eq 0 ]
}

@test "validate DNS resolving" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  result=$(ssh -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no ${USER}@${IP} getent ahostsv4 one.one.one.one | grep -e '1\.1\.1\.1')
  [ "$?" -eq 0 ]
}

@test "validate chrony consume ptp" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  if [ "$CONFIG_NAME" == "debian-9-stretch" ]; then
    skip "test does not apply to Debian 9 (exception due legacy)"
  fi
  result=$(ssh -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no ${USER}@${IP} sudo chronyc sources | grep 'PHC0')
  [ "$?" -eq 0 ]
}

@test "validate listen services" {
  # Only allow SSH to listen on a public network interface
  # The entire 127.0.0.0/8 CIDR block is used for loopback routing.
  if [ "$CONFIG_DISTRO" != "FREEBSD" ]; then
    ssh -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no ${USER}@${IP} sudo ss -tulpn || sudo netstat -lntu;
    result=$(ssh -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no ${USER}@${IP} 'sudo ss -tulpn || sudo netstat -lepunt' | grep -v \
      -e 'State' \
      -e '*:22' -e '0.0.0.0:22' -e '\[::\]:22' -e ' :::22 ' \
      -e '127.0.0.[0-9]' -e '\[::1\]' -e ' ::1:' | wc -l)
    [ "$result" == "0" ]
  else
    ssh -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no ${USER}@${IP} sockstat -4 -6 -l;
    result=$(ssh -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no ${USER}@${IP} sockstat -4 -6 -l | grep -v \
      -e 'COMMAND' \
      -e '*:22' -e '0.0.0.0:22' -e '\[::\]:22' -e ' :::22 ' \
      -e '127.0.0.[0-9]' -e '\[::1\]' -e ' ::1:' | wc -l)
    [ "$result" == "0" ]
  fi
}

@test "check hostname" {
  result=$(sshrun hostname)
  [ "$?" -eq 0 ]
  [ "$result" == "$HOSTNAME" ]
}

@test "resize rootfs (FreeBSD)" {
  if [ "$CONFIG_DISTRO" != "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  result=$(sshrun df / | tail -n 1 | cut -d' ' -f3)
  [ "$?" -eq 0 ]
  [ "$result" -gt "$(( 5 * 1024 * 1024 ))" ]
}

@test "resize rootfs (Linux)" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  block_count=$(sshrun stat / -f -c "%b")
  [ "$?" -eq 0 ]
	block_size=$(sshrun stat / -f -c "%s")
  [ "$?" -eq 0 ]
  [ "$(($block_count * $block_size))" -gt "$((5 * 1024 * 1024 * 1024 ))" ]
}

@test "resize rootfs (FreeBSD)" {
  if [ "$CONFIG_DISTRO" != "FREEBSD" ]; then
    skip "test does apply only to FreeBSD"
  fi
  result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} df / | tail -n 1 | cut -d' ' -f3)
  [ "$?" -eq 0 ]
  [ "$result" -gt "$(( 5 * 1024 * 1024 ))" ]
}

@test "available /dev/rtc0" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  sshrun ls /dev/rtc0;
  [ "$?" -eq 0 ]
}

@test "check default target" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  is_systemctl=$(sshrun "command -v systemctl || echo ''")
  if [  "$is_systemctl" != "" ]; then
    target=$(sshrun "systemctl  get-default")
    is_desktop=$(sshrun "dpkg -l|grep ubuntu-desktop || echo ''")
    if [ "$is_desktop" != "" ]; then
       [ "$target" == "graphical.target" ]
    else
       [ "$target" == "multi-user.target" ]
    fi
  else
    [ 1 ]
  fi
}

@test "floppy kernel module" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  run sshrun "lsmod | grep floppy"
  [ "$status" -eq 1 ]
}
