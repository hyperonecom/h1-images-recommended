#!/bin/sh
set -euo
openssl aes-256-cbc -K $encrypted_9ca81b5594f5_key -iv $encrypted_9ca81b5594f5_iv \
-in ./resources/secrets/id_rsa.enc -out ./resources/secrets/id_rsa -d;
cp ./resources/secrets/id_rsa.pub ./resources/ssh/id_rsa.pubs;
docker build . -t recommended-images;
docker run --rm -it -e H1_TOKEN="$H1_TOKEN" recommended-images nodejs buildTestPublish.js "$TEMPLATE"
docker run --rm -it -e H1_TOKEN="$H1_TOKEN" recommended-images nodejs cleanupImage.js;