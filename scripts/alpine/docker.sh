#!/bin/sh
set -eux
apk add docker;
apk --no-cache add --repository "${MIRROR}/edge/testing" docker-compose;
rc-update add docker boot;
