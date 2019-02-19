#FROM golang as packer
#ENV PACKER_BRANCH="hyperone"
## Setup
#RUN git clone https://github.com/hyperonecom/packer.git -b "${PACKER_BRANCH}" --single-branch --depth 1
#WORKDIR /go/packer
#
## Hot-patch (serie 1)
#RUN rm go.sum
#
## Build
#RUN make dev
#ENV PATH=/go/packer/bin/:$PATH

FROM node
ENV H1_CLI_VERSION="v1.4.0"
#COPY --from=packer /go/packer/bin/packer /bin/packer
RUN curl -s -L http://62.181.8.248/packer -o /bin/packer \
&& chmod +x /bin/packer
RUN apt-get update \
&& apt-get install bats \
&& rm -rf /var/lib/apt/lists/*
#RUN curl -s -L "https://github.com/hyperonecom/h1-cli/releases/download/${H1_CLI_VERSION}/h1-linux" -o /bin/h1 \
#&& chmod +x /bin/h1
RUN npm install -g https://github.com/hyperonecom/h1-cli/archive/develop.tar.gz
WORKDIR /src/
COPY ./package*.json /src/
COPY ./resources/ssh/id_rsa* /root/.ssh/
RUN chmod 0600 /root/.ssh/id_rsa*
RUN md5sum /root/.ssh/* && ls -lah /root/.ssh
RUN npm ci
COPY ./ /src/
CMD ["nodejs", "./buildTestPublish.js", "./templates/qcow/debian-8.json"]