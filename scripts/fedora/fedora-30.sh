#!/bin/sh
# See https://bugzilla.redhat.com/show_bug.cgi?id=1712935#c35v
sed 's@SELINUX=enforcing@SELINUX=permissive@g' /etc/selinux/config -i
