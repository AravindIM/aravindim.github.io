---
author: Aravind I M
date: 2023-07-08
title: How to install Arch Linux the secure way (GRUB Method)
postSlug: install-arch-linux-the-secure-way-grub
featured: true
draft: false
tags:
  - tutorial
  - arch-linux
  - installation
  - uefi
  - luks
  - secure-boot
  - lvm
  - btrfs
  - grub
categories:
  - system-administration
summary: A comprehensive, step-by-step tutorial to install Arch Linux the secure way using UEFI, LUKS full-disk encryption, LVM, Btrfs, GRUB, and Secure Boot.
---

If you are looking to **install Arch Linux the secure way**, you have come to the right place. This step-by-step tutorial walks you through a robust, hardened setup featuring UEFI, LUKS full-disk encryption, LVM, Btrfs, GRUB, and Secure Boot. 

Why this combination? LUKS ensures your data remains completely inaccessible to thieves, LVM gives you flexible partition management, Btrfs allows for easy system snapshots, and Secure Boot ensures only trusted code runs during startup.

## Step 1: Connect to a Wi-Fi Network

Arch Linux requires an active internet connection to download base packages. We will use `iwctl` to connect.

```console
# iwctl
[iwd]# device list
[iwd]# device deviceName set-property Powered on
[iwd]# station deviceName scan
[iwd]# station deviceName get-networks
[iwd]# station deviceName connect SSID
[iwd]# exit
```

Ensure you are successfully connected by pinging the Arch Linux servers:

```console
$ ping archlinux.org
```

## Step 2: Check System Time

Ensure your system clock is accurate to prevent cryptographic and network errors during package installation.

```console
$ timedatectl
```

## Step 3: Partition Disks

Create Partitions using fdisk

1. Check available disks:
```console
# fdisk -l
```

2. Enter fdisk:
```console
# fdisk /dev/sdX
```

3. Create a new GPT disk label:
```console
Command (m for help): g
Created a new GPT disklabel (GUID: ...).
```
 
4. Create the EFI boot partition (512M):
```console
Command (m for help): n
Partition number: 
First sector: 
Last sector, +/-sectors or +/-size{K,M,G,T,P}: +512M

Command (m for help): t
Partition type or alias (type L to list all): uefi
```

5. Make the remaining space a partition for LUKS:
```console
Command (m for help): n
Partition number: 
First sector: 
Last sector, +/-sectors or +/-size{K,M,G,T,P}: 
```

6. Print partition info to verify
```console
Command (m for help): p
```

7. Write changes to the disk and quit:
```console
Command (m for help): w
```
(Tip: Type q to quit without writing changes in case of mistakes).

## Step 4: Format Boot disk

```console
# mkfs.fat -F 32 -n EFI /dev/sdXY
```

## Step 5: Setup LUKS Disk Encryption

We will use LUKS1 to encrypt the root partition, securing your data at rest.

### Create LUKS partition

```console
# cryptsetup --use-random --type luks1 luksFormat /dev/sdXZ
Are you sure? YES
Enter passphrase:
Verify passphrase:
```

### Open LUKS partition

You can use any name instead of cryptroot, but be sure to replace it everywhere in the following commands.
```console
# cryptsetup open /dev/sdXZ cryptroot
```

#### Note

Once you create LVM, you only need to open the disk with cryptsetup. No additional command is needed to access the volume group (vg)—all existing LVM partitions are accessible right after unlocking the LUKS partition. This is handy if you have to reboot after the LVM setup

## Step 6: Setup LVM (Logical Volume Manager)

LVM allows for flexible resizing of partitions. This step assumes you don't need a separate home partition on LVM.

### Create LVM group

```console
# pvcreate /dev/mapper/cryptroot
# vgcreate vgroot /dev/mapper/cryptroot
```

### Create LVM Partitions

Create an 8GB swap partition:
```console
# lvcreate --size 8G vgroot --name swap
```

Allocate the rest of the space to the root partition:
```console
# lvcreate -l +100%FREE vgroot --name root
```

## Format LVM partitions

Format the swap volume:
```console
# mkswap /dev/vgroot/swap -L swap
```

Format the root volume as Btrfs:
```console
# mkfs.btrfs /dev/vgroot/root -L root
```

## Step 7: Create Btrfs Subvolumes

Btrfs subvolumes allow you to isolate system data from user data and create easy system snapshots.

Mount the Btrfs partition to /mnt (the install target root):
```console
# mount -t btrfs LABEL=root /mnt
```

Create the required subvolumes one by one:
```console
# btrfs subvolume create /mnt/@
# btrfs subvolume create /mnt/@home
# btrfs subvolume create /mnt/@tmp
# btrfs subvolume create /mnt/@varlog
# btrfs subvolume create /mnt/@snapshots
```

Disable Copy-on-Write for tmp and varlog to improve performance for highly volatile files:
```console
# chattr +C /mnt/@tmp
# chattr +C /mnt/@varlog
```

Unmount /mnt:
```console
# umount -R /mnt
```

## Step 8: Mount Partitions

### Mount Btrfs Subvolumes

We will mount the volumes with specific optimizations. Here is what the options mean:
- `commit` = time interval between data-writes in seconds
- `x-mount.mkdir` = make directory if not existing when mounting
- `ssd` = ssd based btrfs optimisations
- `noatime` & `nodiratime` = do not store access time for files/directories (makes btrfs faster)
- `discard` = asynchronous queued TRIM to discard freed file blocks

First, check if discard is supported by checking if the output is greater than 0:
```console
# cat /sys/block/sdX/queue/discard_max_bytes
```

Mount btrfs subvolumes one by one:
```console
# mount -t btrfs -o defaults,x-mount.mkdir,compress=zstd,ssd,noatime,nodiratime,discard=async,space_cache=v2,commit=120,subvol=@ LABEL=root /mnt
# mount -t btrfs -o defaults,x-mount.mkdir,compress=zstd,ssd,noatime,nodiratime,discard=async,space_cache=v2,commit=120,subvol=@home LABEL=root /mnt/home
# mount -t btrfs -o defaults,x-mount.mkdir,compress=zstd,ssd,noatime,nodiratime,discard=async,space_cache=v2,commit=120,subvol=@tmp LABEL=root /mnt/tmp
# mount -t btrfs -o defaults,x-mount.mkdir,compress=zstd,ssd,noatime,nodiratime,discard=async,space_cache=v2,commit=120,subvol=@varlog LABEL=root /mnt/var/log
# mount -t btrfs -o defaults,x-mount.mkdir,compress=zstd,ssd,noatime,nodiratime,discard=async,space_cache=v2,commit=120,subvol=@snapshots LABEL=root /mnt/.snapshots
```

### Mount the EFI Directory

```console
# mkdir -p /mnt/boot/efi
# mount LABEL=EFI /mnt/boot/efi
```

## Step 9: Setup Mirrorlist Using Reflector

To ensure maximum download speeds, configure your mirrorlist. Install reflector:
```console
# pacman -Syy reflector
```

Configure the mirrorlist using reflector:
```console
# reflector --verbose --sort rate --save /etc/pacman.d/mirrorlist
```

## Step 10: Install Base Packages (Pacstrap)

Install the foundational Linux packages into the mounted root directory.
```console
# pacstrap -K /mnt base linux linux-firmware vim nano
```

## Step 11: Generate Mount Info Fstab

Generate the fstab file so the system knows how to mount your partitions on boot.
```console
# genfstab -L -p /mnt >> /mnt/etc/fstab
```

## Step 12: Chroot into Installed Environment

Shift into your newly installed system to configure it.
```console
# arch-chroot /mnt
```

## Step 13: Set Timezone

Link your local time zone and sync the hardware clock.
```console
# ln -sf /usr/share/zoneinfo/Region/City /etc/localtime
hwclock --systohc
```

## Step 14: Set Locale

Edit `/etc/locale.gen` and uncomment your required locales, then generate them:

```console
# locale-gen
```

Create `/etc/locale.conf` with content:
```console
LANG=en_US.UTF-8
```

## Step 15: Configure Hostname

Set the name of your computer.
```console
# echo yourhostname >> /etc/hostname
```

## Step 16: Install Additional Packages

Install required programs like the shell, development packages, sudo, Btrfs tools, Secure Boot manager, microcode, Bluetooth, Wi-Fi, and your desktop environment (GNOME).
```console
# pacman -Syu base-devel btrfs-progs gptfdisk zsh sudo ttf-dejavu noto-fonts noto-fonts-cjk intel-ucode polkit wpa_supplicant mesa lvm2 efibootmgr bash-completion git man pipewire wireplumber pipewire-alsa pipewire-pulse terminus-font gnome
```

(If installing GNOME, select `pipewire-jack`, `wireplumber`, and `noto-fonts-emoji` in the proceeding interactive questions).

## Step 17: Enable Services

Enable essential background services to start automatically on boot.

Enable Gnome Display Manager:
```console
# systemctl enable gdm
```

Enable Network Manager:
```console
# systemctl enable NetworkManager
```

Enable Bluetooth:
```console
# systemctl enable bluetooth
```

## Step 18: User Management

Running as the root user is dangerous. Set a root password and create a standard user with `sudo` privileges.

Create the root password:
```console
# passwd
```

Create your standard user (USERNAME):
```console
# useradd -m -G wheel,storage,power -g users -s /bin/bash USERNAME
```

Create a password for your new user:
```console
# passwd USERNAME
```

Allow the wheel group to execute `sudo` commands by editing the visudo file:
```console
# visudo
```

Search for the following line and remove the `#` in front of it:
```console
%wheel ALL=(ALL:ALL) ALL
```

Switch to your newly created user:
```console
$ sudo -u USERNAME -i
```

## Step 19: Install an AUR Helper (Yay)

Install yay to easily download user-created packages from the Arch User Repository. First, install Go:
```console
$ sudo pacman -Syy go
```

Build and install yay:
```
$ git clone https://aur.archlinux.org/yay.git
$ cd yay
$ makepkg -is
$ cd ..
$ rm -rf yay
```

## Step 20: Configure mkinitcpio Hooks

You must configure `mkinitcpio` so the kernel knows how to handle encryption and LVM during boot. Edit `/etc/mkinitcpio.conf`:
```console
HOOKS=(base udev plymouth modconf kms keyboard keymap block encrypt lvm2 btrfs filesystems fsck)
```

## Step 18: Install Missing Firmware

Install mkinitcpio-firmware using yay:
```console
$ yay -Syy mkinitcpio-firmware
```

## Step 19: GRUB Bootloader Setup

### Install GRUB

```console
$ sudo pacman -Syy grub efibootmgr
```

### Setup Disk Encryption for GRUB

Append/uncomment the following line in `/etc/default/grub`:
```console
GRUB_ENABLE_CRYPTODISK=y
```

### Add Command Line Parameters

In `/etc/default/grub`, edit the default arguments:
```console
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash sysrq_always_enabled=1 fbcon=nodefer cryptdevice=UUID=disk-UUID:cryptroot root=LABEL=root rootflags=subvol=@ rw loglevel=3"
```

### Create a List of Modules for GRUB

Create a list of modules for GRUB. (Note: Apple filesystem and RAID are excluded here. Check the Ubuntu GRUB Secure Boot script in the references for more details).

```console
GRUB_MODULES="
	all_video
	boot
	btrfs
	cat
	chain
	configfile
	echo
	efifwsetup
	efinet
	ext2
	fat
	font
	gettext
	gfxmenu
	gfxterm
	gfxterm_background
	gzio
	halt
	help
	iso9660
	jpeg
	keystatus
	loadenv
	loopback
	linux
	ls
	lsefi
	lsefimmap
	lsefisystab
	lssal
	memdisk
	minicmd
	normal
	ntfs
	part_msdos
	part_gpt
	password_pbkdf2
	png
	probe
	reboot
	regexp
	search
	search_fs_uuid
	search_fs_file
	search_label
	sleep
	smbios
	squash4
	test
	true
	video
	cpuid
	play
	tpm
	cryptodisk
	gcry_rsa
	gcry_seed
	gcry_sha256
	luks
	lvm
	"
```

### Install GRUB on ESP (EFI System Partition)

```console
$ sudo  grub-install --target=x86_64-efi --efi-directory=/boot/efi --modules=${GRUB_MODULES} --disable-shim-lock
```

### Generate GRUB Config

```console
$ sudo grub-mkconfig -o /boot/grub/grub.cfg
```

## Step 20: Avoiding Double Passphrase Entry

Since GRUB prompts for your LUKS password to load the kernel, you can configure a keyfile to prevent having to type it a second time as the system boots.

Create the keyfile and add it to LUKS:
```console
$ sudo dd bs=512 count=4 if=/dev/random of=/root/cryptlvm.keyfile iflag=fullblock
$ sudo chmod 000 /root/cryptlvm.keyfile
$ sudo cryptsetup -v luksAddKey /dev/sda3 /root/cryptlvm.keyfile
```

Edit `/etc/mkinitcpio.conf` to include the keyfile:
```console
FILES=(/root/cryptlvm.keyfile)
```

Generate initramfs and secure the embedded keyfile:
```console
$ sudo mkinitcpio -P
$ sudo chmod 600 /boot/initramfs-linux*
```

Edit /etc/default/grub and add the cryptkey parameter:
```console
GRUB_CMDLINE_LINUX_DEFAULT="...cryptkey=rootfs:/root/cryptlvm.keyfile..."
```

Regenerate the GRUB config:
```console
$ sudo grub-mkconfig -o /boot/grub/grub.cfg
```

## Step 21: Secure boot setup

### Install Secure Boot Manager (sbctl)

```console
$ sudo pacman -Syyu sbctl
```

### Create and Enroll Secure Boot Keys

Create the keys:
```console
$ sudo sbctl create-keys
```

Change attributes of keys in Btrfs:
```console
$ sudo chattr -i /sys/firmware/efi/efivars/{PK,KEK,db}*
```
(If either PK, KEK, or db causes the command to fail, remove that specific one from the list and run with the rest).

Enroll the keys alongside Microsoft's keys:
```console
$ sudo sbctl enroll-keys -m
```

### Sign the Bootloader

Sign GRUB and the Linux kernel to satisfy Secure Boot:
```console
$ sudo sbctl sign -s -o /boot/efi/EFI/arch/grubx64.efi /boot/efi/EFI/arch/grubx64.efi
$ sudo sbctl sign -s -o /boot/vmlinuz-linux /boot/vmlinuz-linux
```

## Step 22: Plymouth Setup

Plymouth provides an elegant, flicker-free graphical boot splash screen.

Install Plymouth:
```console
$ sudo pacman -Syy plymouth
```

Install the theme via Yay:
```console
$ yay -Syy plymouth-theme-bgrt-better-luks 
```

View and set the Plymouth theme:
```console
$ sudo plymouth-set-default-theme -l
$ sudo plymouth-set-default-theme -R bgrt-better-luks
```

Re-run mkinitcpio to apply changes:
```console
$ sudo mkinitcpio -P
```

## Step 23: Finish Install

Log out of your user account, exit the chroot environment, unmount your drives, and reboot into your new, highly secure system!
```console
$ exit
# exit
# umount -a
# reboot
```

*Final Step:* Don't forget to physically turn on Secure Boot in your motherboard's BIOS after rebooting. Nothing else is needed.

## Frequently Asked Questions (FAQ)

### 1. Why use GRUB instead of systemd-boot for Arch Linux?
While systemd-boot is simpler, GRUB provides more advanced features for complex partition layouts. In this tutorial, GRUB handles the decryption of the LUKS partition before passing control to the OS, which is highly preferred by some security advocates. If you prefer systemd-boot, check out my alternative guide!

### 2. Why should I use Btrfs with LUKS?
LUKS provides the heavy-duty security (encryption at rest), while Btrfs provides modern file system features. Btrfs allows you to take instant snapshots of your system. If an update breaks your Arch Linux install, you can simply roll back to a snapshot from the previous day without losing your encrypted setup.

### 3. Is an 8GB swap partition enough?
Yes, 8GB is generally sufficient for modern systems with 16GB of RAM or more. However, if you plan to use hibernation on a system with 32GB of RAM, you will need a swap partition at least as large as your total RAM.

## 24. Reference

1. https://wiki.archlinux.org/title/User:ZachHilman/Installation_-_Btrfs_%2B_LUKS2_%2B_Secure_Boot

2. https://wiki.archlinux.org/title/Installation_guide

3. https://gist.github.com/mjnaderi/28264ce68f87f52f2cabb823a503e673

4. https://gist.github.com/martijnvermaat/76f2e24d0239470dd71050358b4d5134

5. https://nerdstuff.org/posts/2020/2020-004_arch_linux_luks_btrfs_systemd-boot/

6. https://github.com/Szwendacz99/Arch-install-encrypted-btrfs

7. https://www.reddit.com/r/archlinux/comments/127fp6g/plymouthencrypt_hook_no_longer_found_after_update/

8. https://bbs.archlinux.org/viewtopic.php?id=284741

9. https://www.youtube.com/watch?v=QQoZwP6-Y2k

10. https://github.com/AravindIM/nixos-dotfiles/blob/main/hosts/thinkpad/hardware-configuration.nix

11. https://github.com/AravindIM/arch-install/blob/main/install-gnome.sh

12. https://github.com/0xadeeb/dotFiles

13. https://github.com/0xadeeb/NixOs-config/blob/master/hosts/hp-pavilion/hardware-configuration.nix

14. https://bbs.archlinux.org/viewtopic.php?id=243019

15. https://wiki.archlinux.org/title/Talk:Mkinitcpio#Improvements_for_the_Common_hooks_table_and_section_about_systemd_hook

16. https://wiki.archlinux.org/title/Power_management/Suspend_and_hibernate

17. https://askubuntu.com/questions/1304519/fstab-automatically-creates-mount-points

18. https://wiki.archlinux.org/title/User:Bai-Chiang/Installation_notes

19. https://wiki.archlinux.org/title/Unified_Extensible_Firmware_Interface/Secure_Boot

20. https://wiki.archlinux.org/title/Unified_kernel_image

21. https://wiki.archlinux.org/title/AUR_helpers

22. https://linuxhint.com/btrfs-filesystem-mount-options/

23. https://linuxconfig.org/how-to-manage-efi-boot-manager-entries-on-linux

24. https://wiki.archlinux.org/title/dm-crypt/Encrypting_an_entire_system#Encrypted_boot_partition_(GRUB)

25. https://git.launchpad.net/~ubuntu-core-dev/grub/+git/ubuntu/tree/debian/build-efi-images?h=debian/2.06-2ubuntu12

26. https://binary-manu.github.io/binary-is-better/linux/archlinux-secure-boot

27. https://wiki.archlinux.org/title/dm-crypt/Encrypting_an_entire_system#Avoiding_having_to_enter_the_passphrase_twice

28. https://wiki.archlinux.org/title/dm-crypt/Encrypting_an_entire_system#Encrypted_boot_partition_(GRUB/)
