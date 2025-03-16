#!/bin/sh

# disable LLMR and mDNS, by default listening on public interfaces
# LLMR = Link-Local Multicast Name Resolution
# mDNS = Multicast DNS

mkdir -p /etc/systemd/resolved.conf.d/

cat <<EOT > /etc/systemd/resolved.conf.d/disable-llmnr-mdns.conf
[Resolve]
LLMNR=no
MulticastDNS=no
EOT

systemctl restart systemd-resolved