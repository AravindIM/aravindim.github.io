---
author: Aravind I M
pubDatetime: 2022-11-03T19:00:00Z
title: How to setup NodeJS for global package installation in Guix
postSlug: how-to-setup-nodejs-in-guix
featured: true
draft: false
tags:
  - docs
  - guix
  - nodejs
  - npm
  - webdev
  - web
  - guixsd
description: Guide on how to setup NodeJS for global package installation in Guix
---

## Table of contents

## Install node from guix repo

Either install it into user's guix profile using the following command:

```bash
guix pull
guix install node
```

Or install it system-wide by adding the line (specification->package "node") to your system's config file <mark>/etc/config.scm</mark> as shown below:

```scheme
(operating-system
  ...
  (packages
    (append
      (list
        ...
        (specification->package "node")
        ...)
      %base-packages))
...)
```

Reconfigure the system if installing node system-wide:

```bash
guix pull
sudo guix system reconfigure /etc/config.scm
```

## Setup custom install folder for npm packages

Create a folder <mark>.vnode</mark> for npm global installation of packages in home instead of root and enable it:

```bash
mkdir $HOME/.vnode
npm config set prefix "$HOME/.vnode"
```

Add the <mark>bin</mark> folder inside <mark>.vnode</mark> directory to <mark>~/.bashrc</mark> or <mark>~/.zshrc</mark> and then source the file. It's recommended that you logout and log back in. Otherwise, you'll need to source the directory everytime you need to use the npm.

```bash
echo "export PATH=$HOME/.vnode/bin:$PATH" >> ~/.bashrc
source ~/.bashrc
```

Install npm globally and it will install into that directory.

```bash
npm install -g npm
```

## Setup preinstall script

Now add the following preinstall script into <mark>$HOME/.vnode/lib/node_modules/.hooks/preinstall</mark> using a text editor.

```bash
#/usr/bin/env bash

pkg_path=$PWD

function patch_shebang() {
 file=$1
 python_bin=`type -p python`
 ruby_bin=`type -p ruby`
 env_bin=`type -p env`
 bash_bin=`type -p bash`

 if [ -n "$env_bin" ]; then
   sed -i -uE "s|^#!.+/env|#!${env_bin}|" $file
 elif [ -n "$bash_bin" ]; then
   sed -i -uE "s|^#!.+/bash|#!${bash_bin}|" $file
 elif [ -n "$python_bin" ]; then
     sed -i -uE "s|^#!.+/bash|#!${python_bin}|" $file
 elif [ -n "$ruby_bin" ]; then
     sed -i -uE "s|^#!.+/bash|#!${ruby_bin}|" $file
 fi
}

files=`find $pkg_path -type f -exec grep -lE '^#!(.+ )' {} \;`

for file in $files; do
 patch_shebang $file
done
```

Allow execution of the script.

```bash
chmod a+rx $HOME/.vnode/node_modules/.hooks/preinstall
```

If everything went well, you will now be able to run <mark>npm install -g package-name</mark> and install global packages into the newly created directory <mark>.vnode</mark>. For local packages just copy the preinstall script into <mark>myprojectdir/node_modules/.hooks/preinstall</mark>.
