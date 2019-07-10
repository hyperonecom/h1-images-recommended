#!/bin/sh
# Docker-Engine + Docker-CLI
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg2 \
    software-properties-common;
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -;
add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/debian \
   $(lsb_release -cs) \
   stable";
apt-get update;
apt-get install -y docker-ce docker-ce-cli containerd.io;
# Docker-Compose
COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases?per_page=1 | sed -E -n 's/^.*tag_name": "(.+?)".*$/\1/p')
curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose;
chmod +x /usr/local/bin/docker-compose;
# Docker-Compose (bash completion)
curl -L https://raw.githubusercontent.com/docker/compose/${COMPOSE_VERSION}/contrib/completion/bash/docker-compose -o /etc/bash_completion.d/docker-compose
