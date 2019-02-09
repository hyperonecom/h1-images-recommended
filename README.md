# h1-recommended-images

[![Build Status](https://www.travis-ci.com/hyperonecom/h1-images-recommended.svg?branch=master)](https://www.travis-ci.com/hyperonecom/h1-images-recommended)

A set of Packer templates for building recommended images for the HyperOne platform and compatible with it.

## Structure

It should highlight the following elements:

- ```render.js``` - script responsible for generating Packer templates files,
- ```config``` - source files for templates
- ```templates```- Packer template set
- ```templates/builder-*.json``` - the image of the virtual machine used when building
- ```templates/qcow``` - Packer templates generated via QCOW2 files defined in ```config/qcow```

All templates create *Image* by running builder VM with additional *Disk* and using a chroot environment to provision that *Disk*. Then attach that *Disk* to new *Virtual Machine* to create clean image. This allows to 

## Design principles

 * get an *Image* with the operating system that is first run by the user.
 * introducing minimal changes to the systems
 * full automation of the process to ensure the minimum cost of maintaining the update
 * for operating systems that support SELinux - keep it enabled

## Usage

A current version of Packer is required which supports ```hyperone``` builder.

First build a builder image:

```bash
packer build builder-fedora.json
```

It is recommended to use Fedora-based builder for proper SELinux support.

Next to build any other template eg.:

```bash
packer build templates/qcow/fedora-29.json
```

## Utils scripts

* ```render_templates.js``` - regenerate ```templates/*``` based on ```config/*```
* ```render_travis.yml.js``` - regenerate ```.travis.yml``` based on ```templates/*```
* ```run_tests.sh``` - performs basic tests of the correct operation of the image
* ```buildTestPublish.js``` - build & test & publish image

# Tests

First create SSH key-pair in ```resources/ssh/id_rsa```:

```bash
ssh-keygen -f resources/ssh/id_rsa
```

Then upload SSH keys available in project as ```builder-ssh```:

```bash
h1 project credentials add --name builder-ssh --sshkey-file ./resources/ssh/id_rsa.pub
```

Finally you can use ```run_tests.sh``` or ```buildTestPublish.js``` to manange images.
