#!/bin/sh
set -eux
# downgrade python for cloud-init
rm /usr/lib/python3.8/site-packages/__pycache__/ -r
mv /usr/lib/python3.8/site-packages/* /usr/lib/python3.7/site-packages/