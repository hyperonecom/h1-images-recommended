#!/bin/sh
set -eux
ENCRYPT_KEY=$1
# Manage secrets
openssl aes-256-cbc -k "$ENCRYPT_KEY" -in ./resources/secrets/id_rsa.enc -out ./resources/secrets/id_rsa -d;
md5sum ./resources/ssh/id_rsa* ./resources/secrets/id_rsa*;
# Install secrets ssh keys
rm ./resources/ssh/id_rsa*;
cp ./resources/secrets/id_rsa* ./resources/ssh/;

# Install Docker
# Pre-installed Docker doesn't support multi-stage builds
# See https://github.com/travis-ci/travis-ci/issues/8181
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -;
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable";
sudo apt-get update;
sudo apt-get -y  -o Dpkg::Options::="--force-confnew" install docker-ce;