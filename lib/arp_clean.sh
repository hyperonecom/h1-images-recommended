#!/bin/bash
if [[ -z "$CI" ]]; then
    echo "Running out-of-CI. Skipping arp flush";
    exit 0;
fi;

[ -f "/.dockerenv"] && docker run --network host --privileged debian ip -s -s neigh flush all || echo "Failed to flush ARP cache of host";
ip -s -s neigh flush all || echo 'Failed to flush local ARP table';
