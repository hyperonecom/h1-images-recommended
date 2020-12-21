#!/usr/bin/env bats

@test "ssh using key" {
  result="$(ssh -o StrictHostKeyChecking=no ${USER}@${IP} whoami)"
  [ "$?" -eq 0 ]
}

@test "ssh using password" {
skip
}

@test "check sudo works" {
  result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "sudo id")
  [ "$?" -eq 0 ]
  [[ "$result" =~ "root" ]]
}

@test "check /etc/hosts" {
  result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "sudo grep $HOSTNAME /etc/hosts |cut -f1 ")
  [ "$?" -eq 0 ]
  [[ "$result" =~ "127.0" ]]
}

@test "check grub consoleblank" {
  skip
  result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "grep 'consoleblank=0' /proc/cmdline")
  [ "$?" -eq 0 ]
}


# @test "check cloudinit done" {
#   result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "grep 'done' <(cloud-init status)")
#   [ "$?" -eq 0 ]
# }


# @test "check arping executed" {
#   result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "grep -E 'packets transmitted|Sent' /var/log/cloud-init*")
#   [ "$?" -eq 0 ]
# }


@test "check userdata available" {
  result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "cat /userdata")
  [ "$?" -eq 0 ]
}

@test "check grub console redirection" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "grep 'console=ttyS0,115200n8' /proc/cmdline")
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
    skip "test does not apply to Debian 9 (exception due lelgacy)"
  fi
  result=$(ssh -o UserKnownHostsFile=/dev/null  -o StrictHostKeyChecking=no ${USER}@${IP} sudo chronyc sources | grep 'PHC0')
  [ "$?" -eq 0 ]
}

@test "check hostname" {
  result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} hostname)
  [ "$?" -eq 0 ]
  [ "$result" == "$HOSTNAME" ]
}

@test "resize rootfs (FreeBSD)" {
  if [ "$CONFIG_DISTRO" != "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} df / | tail -n 1 | cut -d' ' -f3)
  [ "$?" -eq 0 ]
  [ "$result" -gt "$(( 5 * 1024 * 1024 ))" ]
}

@test "resize rootfs (Linux)" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  block_count=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} stat / -f -c "%b")
  [ "$?" -eq 0 ]
	block_size=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} stat / -f -c "%s")
  [ "$?" -eq 0 ]
  [ "$(($block_count * $block_size))" -gt "$((5 * 1024 * 1024 * 1024 ))" ]
}

@test "resize rootfs (FreeBSD)" {
  if [ "$CONFIG_DISTRO" != "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  result=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} df / | tail -n 1 | cut -d' ' -f3)
  [ "$?" -eq 0 ]
  [ "$result" -gt "$(( 5 * 1024 * 1024 ))" ]
}

@test "available /dev/rtc0" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} ls /dev/rtc0;
  [ "$?" -eq 0 ]
}

@test "check default target" {
  if [ "$CONFIG_DISTRO" == "FREEBSD" ]; then
    skip "test does not apply to FreeBSD"
  fi
  is_systemctl=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "command -v systemctl || echo ''")
  if [  "$is_systemctl" != "" ]; then
    target=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "systemctl  get-default")
    is_desktop=$(ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no ${USER}@${IP} "dpkg -l|grep ubuntu-desktop || echo ''")
    if [ "$is_desktop" != "" ]; then
       [ "$target" == "graphical.target" ]
    else
       [ "$target" == "multi-user.target" ]
    fi
  else
    [ 1 ]
  fi
}

