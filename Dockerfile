FROM golang:1.19 AS builder
WORKDIR /app
RUN git clone https://github.com/hashicorp/packer-plugin-hyperone.git
RUN cd ./packer-plugin-hyperone && \
    go mod download && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build

FROM node:22
ENV DOCKER_VERSION=20.10.1
ENV PACKER_VERSION=1.12.0
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz -o "docker-${DOCKER_VERSION}.tgz" \
&& tar xzvf "docker-${DOCKER_VERSION}.tgz" --strip 1 -C /usr/local/bin docker/docker \
&& rm "docker-${DOCKER_VERSION}.tgz"
RUN curl -fsSL "https://releases.hashicorp.com/packer/${PACKER_VERSION}/packer_${PACKER_VERSION}_linux_amd64.zip" -o packer.zip \
&& ls -lah packer.zip \
&& unzip -d /usr/local/bin packer.zip packer \
&& chmod +x /usr/local/bin/packer \
&& rm packer.zip
COPY --from=builder /app/packer-plugin-hyperone/packer-plugin-hyperone /tmp/packer-plugin-hyperone
RUN packer plugins install --path /tmp/packer-plugin-hyperone "github.com/hashicorp/hyperone"
RUN VERSION_CODENAME=$(sed -E -n 's/VERSION=.*\((.+?)\).*$/\1/gp' /etc/os-release) \
&& curl -fsSL "http://packages.hyperone.cloud/gpg.public.txt" | apt-key add -  \
&& curl -fsSL "http://packages.rootbox.cloud/gpg.public.txt" | apt-key add -  \
&& echo "deb [arch=amd64] http://packages.hyperone.cloud/linux/debian/ $VERSION_CODENAME stable" > /etc/apt/sources.list.d/hyperone.list \
&& echo "deb [arch=amd64] http://packages.rootbox.cloud/linux/debian/ $VERSION_CODENAME stable" > /etc/apt/sources.list.d/rootbox.list \
&& apt-get update \
&& apt-get install -y jq netcat-openbsd sshpass unzip iproute2 iputils-ping\
&& rm -rf /var/lib/apt/lists/*
RUN cd /tmp && git clone https://github.com/bats-core/bats-core.git && cd bats-core && ./install.sh /usr/local
RUN curl -fsSL "https://github.com/hyperonecom/h1-cli/releases/download/v2.2.0/h1-linux.tar.gz" -o /tmp/h1-linux.tar.gz \
&& tar zxf /tmp/h1-linux.tar.gz -C /bin
WORKDIR /src/
COPY ./package*.json /src/
COPY ./resources/ssh/id_rsa* /root/.ssh/
RUN chmod 0600 /root/.ssh/id_rsa*
RUN npm ci
COPY ./ /src/
CMD ["nodejs", "./buildTestPublish.js", "./templates/qcow/debian-8.json"]
