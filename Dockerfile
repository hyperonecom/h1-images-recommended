FROM node:16
ENV DOCKER_VERSION=20.10.1
ENV PACKER_VERSION=1.6.6
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz -o "docker-${DOCKER_VERSION}.tgz" \
&& tar xzvf "docker-${DOCKER_VERSION}.tgz" --strip 1 -C /usr/local/bin docker/docker \
&& rm "docker-${DOCKER_VERSION}.tgz"
# RUN curl -s -L "https://github.com/hashicorp/packer/releases/download/nightly/packer_linux_amd64.zip" -o packer.zip \
# && unzip -d /usr/local/bin packer.zip packer \
# && chmod +x /usr/local/bin/packer \
# && rm packer.zip
RUN curl -fsSL "https://releases.hashicorp.com/packer/${PACKER_VERSION}/packer_${PACKER_VERSION}_linux_amd64.zip" -o packer.zip \
&& ls -lah packer.zip \
&& unzip -d /usr/local/bin packer.zip packer \
&& chmod +x /usr/local/bin/packer \
&& rm packer.zip
RUN VERSION_CODENAME=$(sed -E -n 's/VERSION=.*\((.+?)\).*$/\1/gp' /etc/os-release) \
&& curl -fsSL "http://packages.hyperone.cloud/gpg.public.txt" | apt-key add -  \
&& curl -fsSL "http://packages.rootbox.cloud/gpg.public.txt" | apt-key add -  \
&& echo "deb [arch=amd64] http://packages.hyperone.cloud/linux/debian/ $VERSION_CODENAME stable" > /etc/apt/sources.list.d/hyperone.list \
&& echo "deb [arch=amd64] http://packages.rootbox.cloud/linux/debian/ $VERSION_CODENAME stable" > /etc/apt/sources.list.d/rootbox.list \
&& apt-get update \
&& apt-get install -y bats unzip h1-cli rbx-cli \
&& rm -rf /var/lib/apt/lists/*
WORKDIR /src/
COPY ./package*.json /src/
COPY ./resources/ssh/id_rsa* /root/.ssh/
RUN chmod 0600 /root/.ssh/id_rsa*
RUN npm ci
COPY ./ /src/
CMD ["nodejs", "./buildTestPublish.js", "./templates/qcow/debian-8.json"]
