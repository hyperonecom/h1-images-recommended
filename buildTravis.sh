#!/bin/sh
set -euo
cp ./resources/secrets/id_rsa.pub ./resources/ssh/id_rsa.pub;
docker build . -t recommended-images;
docker run --rm -it -e H1_TOKEN="$H1_TOKEN" recommended-images nodejs buildTestPublish.js "$TEMPLATE"
docker run --rm -it -e H1_TOKEN="$H1_TOKEN" recommended-images nodejs cleanupImage.js;