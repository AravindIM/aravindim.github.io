---
author: Aravind I M
date: 2022-11-03
title: How to make dnf faster in Fedora
postSlug: how-to-make-dnf-faster
featured: true
draft: false
tags:
  - tutorial
  - package-manager
  - performance
  - fedora
  - rhel
categories:
  - system-administration
summary: Guide on how to make the Redhat's package manager faster
---

## Setup the config file

To make dnf (Dandified Yum) faster in Fedora, you can edit the <mark>[main]</mark> section in the file <mark>/etc/dnf/dnf.conf</mark> try the following optimization tips:

### Enable Fastest Mirrors

Enable fastest mirrors so that dnf will check all mirrors for the fastest one:

```ini
[main]
...
fastestmirror=True
```

### Enable DeltaRPM

Delta RPM (DRPM) lets you install packages using binary difference between old and new packages.

First install Delta RPM if it is not already installed:

```bash
sudo dnf install deltarpm
```

Now enable that in the <abbr title="/etc/dnf/dnf.conf">dnf config file</abbr>:

```ini
[main]
...
deltarpm=True
```

### Optimise Package Download

Set the maximum number of parrallel downloads of packages in the <abbr title="/etc/dnf/dnf.conf">dnf config file</abbr> according to your internet connection speed.

```ini
[main]
...
max_parallel_downloads=10
```

### Optimise MetaData Refresh Interval

Unlike package managers like apt, dnf periodically refreshes its metadata, which includes packages lists, their dependencies and other information. You can avoid excessive metadata refreshes by increasing the interval of metadata refresh to about 2 hours or more (7200 seconds) in the <abbr title="/etc/dnf/dnf.conf">dnf config file</abbr>:

```ini
[main]
...
metadata_timer_sync=7200
```

## Rebuild DNF Cache

You can rebuild the DNF Cache and rebuilt it after configuring the <abbr title="/etc/dnf/dnf.conf">dnf config file</abbr> as mentioned above

First clean the DNF Cache:

```bash
sudo dnf clean all
```

Then predownload the package headers:

```bash
sudo dnf makecache
```
