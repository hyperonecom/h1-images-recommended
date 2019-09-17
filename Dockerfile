FROM node
ENV H1_CLI_VERSION="1.7.0"
ENV PACKER_VERSION="1.3.5"
RUN apt-get update \
&& apt-get install -y bats unzip \
&& rm -rf /var/lib/apt/lists/*
RUN curl -s -L "https://releases.hashicorp.com/packer/${PACKER_VERSION}/packer_${PACKER_VERSION}_linux_amd64.zip" -o /tmp/packer.zip \
&& unzip -d /bin /tmp/packer.zip packer \
&& chmod +x /bin/packer \
&& rm /tmp/packer.zip
#RUN curl -s -L "https://github.com/hyperonecom/h1-cli/releases/download/v${H1_CLI_VERSION}/h1-linux" -o /bin/h1 \
#&& chmod +x /bin/h1
RUN npm install -g https://github.com/hyperonecom/h1-cli/archive/netadp-scoping.tar.gz
WORKDIR /src/
COPY ./package*.json /src/
COPY ./resources/ssh/id_rsa* /root/.ssh/
RUN chmod 0600 /root/.ssh/id_rsa*
RUN npm ci
COPY ./ /src/
CMD ["nodejs", "./buildTestPublish.js", "./templates/qcow/debian-8.json"]