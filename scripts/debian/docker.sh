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
curl -L "https://github.com/docker/compose/releases/download/1.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose;
chmod +x /usr/local/bin/docker-compose;
# Docker-Compose (bash completion)
curl -L https://raw.githubusercontent.com/docker/compose/1.24.0/contrib/completion/bash/docker-compose -o /etc/bash_completion.d/docker-compose
