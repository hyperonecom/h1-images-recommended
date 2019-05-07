#!/bin/sh
set -eux
cp ./resources/secrets/id_rsa.pub ./resources/ssh/id_rsa.pub;
docker build . -t recommended-images;
COMMON="-e H1_TOKEN=$H1_TOKEN -e RBX_TOKEN=$RBX_TOKEN -e SCOPE=$SCOPE";
docker run --rm -it $COMMON recommended-images nodejs buildTestPublish.js --config "$CONFIG" --mode "$MODE" --cleanup
