# h1-recommended-images

[![Build Status](https://www.travis-ci.com/hyperonecom/h1-images-recommended.svg?branch=master)](https://www.travis-ci.com/hyperonecom/h1-images-recommended)

Scripts and templates to build recommended images for the HyperOne platform and compatible with it.

Repository includes following category of recommended images:

* Recommended images with Linux software - Packer builded
* Recommended images with Microsoft software
* Recommended images with RedHat software - Packer builded

## Structure

There are the following elements

* ```render.js``` - script responsible for generating Packer templates files from spec in ```config``` directory
* ```buildTestPublish.js``` - script responsible for build & test & publish Packer & Windows images according to ```config``` and templates
* ```config``` - config and spec files for images
* ```templates```- Packer template set
* ```templates/builder-*.json``` - Packer templates of image of the virtual machine used when building images
* ```templates/qcow``` - ```render.js```-managed Packer templates - ```templates/manual``` - manual-managed Packer templates non-generated via ```render.js```
* ```templates/autounattend``` - ```render.js```

All Packer templates create *Image* by running builder VM with additional *Disk* and using a chroot environment to provision that *Disk*. Then attach that *Disk* to new *Virtual Machine* to create clean *Image*.

## Design principles

* build an *Image* with the operating system that is first run by the user
* introducing minimal changes to the systems
* full automation of the process to ensure the minimum cost of maintaining of update
* for operating systems that support SELinux - keep it enabled
* follow rules outlined in:
  * [recommended images](https://www.hyperone.com/services/storage/image/resources/recommended-images.html) standard
  * [RedHat Cloud Image Certification Policy Guide](https://access.redhat.com/documentation/en/red-hat-certified-cloud-and-service-provider-certification/1.0/single/cloud-image-certification-policy-guide/) and [Red Hat Certified Cloud and Service Provider Certification Workflow Guide](https://access.redhat.com/documentation/en-us/red_hat_certified_cloud_and_service_provider_certification/1.0/html-single/red_hat_certified_cloud_and_service_provider_certification_workflow_guide/index)

## Usage for Packer-based images

Prerequisites:

* current version of Packer is required which supports ```hyperone``` builder
* [basic Packer knowledge](https://packer.io/intro)
* [HyperOne-specific Packer knowledge](https://packer.io/docs/builders/hyperone.html)

Most of images require available in consumer-project builder image. To create one use following command:

```bash
packer build qcow/builder-fedora.json
```

Next to build any other template eg.:

```bash
packer build templates/qcow/fedora-29.json
```

## Utils scripts

* ```render_templates.js``` - regenerate ```templates/*``` based on ```config/*```
* ```render_travis.yml.js``` - regenerate ```.travis.yml``` based on ```templates/*```
* ```run_tests.sh``` - performs basic tests of the correct operation of the image
* ```buildTestPublish.js``` - build & test & publish image

## Tests

First create SSH key-pair in ```resources/ssh/id_rsa```:

```bash
ssh-keygen -f resources/ssh/id_rsa
```

Then upload SSH keys available in project as ```builder-ssh```:

```bash
h1 project credentials add --name builder-ssh --sshkey-file ./resources/ssh/id_rsa.pub
```

Finally you can use ```run_tests.sh``` or ```buildTestPublish.js``` to manage images.

## Recommended images with Microsoft software

To build recommended images you need:

* ISO with appropriate ```Autounattend.xml``` file

Autounattend.xml can be found in ```resources/autounattend```

To prepare new iso use any software for editing iso and place proper Autounattend.xml file in root of the standard MS Windows Installator iso. For example:

```
wine ./oscdimg.exe -lAIO_OS -u2 -m -bz:\\mnt\\iso\\boot\\etfsboot.com z:\\mnt\\iso z:\\mnt\\Win8.iso
```

Files is repo are named to know for which distro they are, ie. ```Autounattend-Datacenter-Core.xml```, but file on iso has to be named ```Autounattend.xml``` only.

```Autounattend.xml``` files use script found in ```resources/powershell``` .

Build container for builder using following command:

```sh
docker build -f Dockerfile.windows -t h1cr.io/h1-images-recommended-windows:2 .
```

Build image using service account using following command:

```sh
docker run -e H1_TOKEN="..." h1cr.io/h1-images-recommended-windows:2 nodejs buildTestPublish.js --mode 'windows' --config ./config/windows/windows-server-2016-dc-core.yaml;
```
