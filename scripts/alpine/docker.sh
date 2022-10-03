#!/bin/sh
set -eux
apk add docker docker-compose;
rc-update add docker boot;
