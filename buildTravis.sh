#!/bin/sh
set -eux
cp ./resources/secrets/id_rsa.pub ./resources/ssh/id_rsa.pub;
docker build . -t recommended-images;
COMMON="-e H1_TOKEN -e RBX_TOKEN -e SCOPE -e INFLUXDB_HOST -e INFLUXDB_PASSWORD -e INFLUXDB_USER -e REDHAT_SECRET";
docker run --rm -it $COMMON recommended-images nodejs buildTestPublish.js --config "$CONFIG" --mode "$MODE" --cleanup --publish
