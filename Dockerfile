FROM golang:1.13 as packer
ENV PACKER_REPO="github.com/hashicorp/packer"
ENV PACKER_BRANCH="master"
RUN git clone "https://github.com/ad-m/packer.git" -b "hyperone" --single-branch --depth 1 "/go/src/github.com/hashicorp/packer/"
WORKDIR "/go/src/github.com/hashicorp/packer"
RUN make dev
FROM node
ENV PACKER_VERSION="1.5.4"
RUN VERSION_CODENAME=$(sed -E -n 's/VERSION=.*\((.+?)\).*$/\1/gp' /etc/os-release) \
&& curl -fsSL "http://packages.hyperone.cloud/gpg.public.txt" | apt-key add -  \
&& echo "deb [arch=amd64] http://packages.hyperone.cloud/linux/debian/ $VERSION_CODENAME stable" > /etc/apt/sources.list.d/hyperone.list \
&& apt-get update \
&& apt-get install -y bats unzip h1-cli \
&& rm -rf /var/lib/apt/lists/*
# RUN curl -s -L "https://releases.hashicorp.com/packer/${PACKER_VERSION}/packer_${PACKER_VERSION}_linux_amd64.zip" -o /tmp/packer.zip \
# && unzip -d /bin /tmp/packer.zip packer \
# && chmod +x /bin/packer \
# && rm /tmp/packer.zip
COPY --from=packer /go/src/github.com/hashicorp/packer/bin/packer /bin/packer
WORKDIR /src/
COPY ./package*.json /src/
COPY ./resources/ssh/id_rsa* /root/.ssh/
RUN chmod 0600 /root/.ssh/id_rsa*
RUN npm ci
COPY ./ /src/
CMD ["nodejs", "./buildTestPublish.js", "./templates/qcow/debian-8.json"]
