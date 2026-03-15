---
author: Aravind I M
date: 2023-07-08
title: How to install Arch Linux the secure way (GRUB Method)
postSlug: how-to-install-arch-linux-uefi-luks-lvm-btrfs-systemdboot-uki-secure-boot
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
summary: Guide on how to install Arch Linux with UEFI + LUKS + LVM +  BTRFS + GRUB + Secure Boot
---

# Installation Steps

## 1. Connect to Wifi

Source: [iwctl](https://wiki.archlinux.org/title/Iwd#iwctl)

```console
# iwctl
[iwd]# device list
[iwd]# device deviceName set-property Powered on
[iwd]# station deviceName scan
[iwd]# station deviceName get-networks
[iwd]# station deviceName connect SSID
[iwd]# exit
```

### (i) Check internet

```console
$ ping archlinux.org
```

## 2. Check system time

```console
$ timedatectl
```

## 3. Partition disks

### Check disk

```console
# fdisk -l
```

### (ii) Create partitions disk

1. Enter fdisk
```console
# fdisk /dev/sdX
```

2. Create GPT label
```console
Command (m for help): g
Created a new GPT disklabel (GUID: ...).
```
 
2. Create boot partition
```console
Command (m for help): n
Partition number: 
First sector: 
Last sector, +/-sectors or +/-size{K,M,G,T,P}: +512M

Command (m for help): t
Partition type or alias (type L to list all): uefi
```

3. Make remaining partition for LUKS
```console
Command (m for help): n
Partition number: 
First sector: 
Last sector, +/-sectors or +/-size{K,M,G,T,P}: 
```

4. Print partition info to verify
```console
Command (m for help): p
```

5. Write changes (write changes and quit)
```console
Command (m for help): w
```

6. Quit fdisk (quit without writing changes in case of mistakes)
```console
Command (m for help): q
```

### (iii) Format Boot disk

```console
# mkfs.fat -F 32 -n EFI /dev/sdXY
```

## 3. Setup LUKS

### (i) Create LUKS partition

```console
# cryptsetup --use-random --type luks1 luksFormat /dev/sdXZ
Are you sure? YES
Enter passphrase:
Verify passphrase:
```

### (ii) Open LUKS partition

You can use any other name instead of cryptroot but be sure to replace it everywhere in the following commands
```console
# cryptsetup open /dev/sdXZ cryptroot
```

#### Note

Once you created LVM, you only need to open the disk with cryptsetup
No additional command needed to access volume group (vg) all the existing LVM partitions are accessible right after unlocking the luks partition.
This might come in handy if you wish to had to reboot the system after LVM setup

## 4. Setup LVM

### (i) Create LVM group

```console
# pvcreate /dev/mapper/cryptroot
# vgcreate vgroot /dev/mapper/cryptroot
```

### (ii) Create LVM Partitions

This assumes you don't need separate home partition on LVM

Create swap
```console
# lvcreate --size 8G vgroot --name swap
```

Create root
```console
# lvcreate -l +100%FREE vgroot --name root
```

## (iii) Format LVM partitions

Format swap
```console
# mkswap /dev/vgroot/swap -L swap
```

Format root
```console
# mkfs.btrfs /dev/vgroot/root -L root
```

## 5. Create Btrfs Subvolumes

Mount btrfs partition to /mnt (install target root)
```console
# mount -t btrfs LABEL=root /mnt
```

Create partitions one by one
```console
# btrfs subvolume create /mnt/@
# btrfs subvolume create /mnt/@home
# btrfs subvolume create /mnt/@tmp
# btrfs subvolume create /mnt/@varlog
# btrfs subvolume create /mnt/@snapshots
```

Disable Copy-on-Write for tmp and varlog
```console
# chattr +C /mnt/@tmp
# chattr +C /mnt/@varlog
```

Unmount /mnt (install target root)
```console
# umount -R /mnt
```

## 6. Mount Partitions

### (i) Btrfs Subvolumes

The followings options can be set for mounting
- commit = time interval between data-writes in seconds
- x-mount.mkdir = make directory if not existing when mounting
- ssd = ssd based btrfs optimisations
- noatime = do not store access time for files (makes btrfs faster)
- nodiratime = do not store directory access time for files (makes btrfs faster)
- discard = set as async, asynchronous queued TRIM for discard freed file blocks, check below

check if discard is supported by checking if the output is greater than 0:
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

### (ii) Mount EFI dir

```console
# mkdir -p /mnt/boot/efi
# mount LABEL=EFI /mnt/boot/efi
```

## 7. Setup Mirrorlist using Reflector

Install reflector:
```console
# pacman -Syy reflector
```

Configure mirrorlist using reflector:
```console
# reflector --verbose --sort rate --save /etc/pacman.d/mirrorlist
```

## 8. Pacstrap Base Packages

```console
# pacstrap -K /mnt base linux linux-firmware vim nano
```

## 9. Generate Mount Info Fstab

```console
# genfstab -L -p /mnt >> /mnt/etc/fstab
```

## 10. Chroot into Installed Environment

```console
# arch-chroot /mnt
```

## 11. Set Timezone

```console
# ln -sf /usr/share/zoneinfo/Region/City /etc/localtime
hwclock --systohc
```

## 12. Set Locale

Edit /etc/locale.gen and uncomment the required locales then run:

```console
# locale-gen
```

Create /etc/locale.conf with content:
```console
LANG=en_US.UTF-8
```

## 13. Configure Hostname

```console
# echo yourhostname >> /etc/hostname
```

## 14. Install additional packages

Install required programs like shell, development packages, sudo, btfs, secure boot, ucode, bluetooth, wifi, desktop environment, etc
```console
# pacman -Syu base-devel btrfs-progs gptfdisk zsh sudo ttf-dejavu noto-fonts noto-fonts-cjk intel-ucode polkit wpa_supplicant mesa lvm2 efibootmgr bash-completion git man pipewire wireplumber pipewire-alsa pipewire-pulse terminus-font gnome
```

If installing gnome select pipewire-jack, wireplumber, noto-fonts-emoji in the proceeding interactive questions

## 15. Enable services

Enable Gnome Display Manager
```console
# systemctl enable gdm
```

Enable Network Manager
```console
# systemctl enable NetworkManager
```

Enable Bluetooth
```console
# systemctl enable bluetooth
```

## 16. User Management

Create root password
```console
# passwd
```

create user USERNAME:
```console
# useradd -m -G wheel,storage,power -g users -s /bin/bash USERNAME
```

create password for user USERNAME:
```console
# passwd USERNAME
```

Don't forget to uncomment wheel line with visudo:
```console
# visudo
```

Search for the following line and remove the # infront of it:
```console
%wheel ALL=(ALL:ALL) ALL
```

Switch user to USERNAME
```console
$ sudo -u USERNAME -i
```

## 17. Install Aur helper

Install the dependencies for yay
```console
# pacman -Syy go
```

Switch to a normal user USERNAME and install yay
```
# su - USERNAME
$ git clone https://aur.archlinux.org/yay.git
$ cd yay
$ makepkg -is
$ cd ..
$ rm -rf yay
```

## 16. Configure mkinitcpio Hooks

Edit /etc/mkinitcpio.conf:
```console
HOOKS=(base udev plymouth modconf kms keyboard keymap block encrypt lvm2 btrfs filesystems fsck)
```

## 17. Install missing firmware

After installing yay, if you're logged in as root, switch to normal user USERNAME and install mkinitcpio-firmware
```console
# su - USERNAME
$ yay -Syy mkinitcpio-firmware
```

## 18. Grub Setup

(Skip to Unified Kernel Image Setup if you want to use systemd-boot instead)

### (i) Install grub

```console
# pacman -Syy grub efibootmgr
```

### (ii) Setup Disk Encryption for Grub

Append/uncomment the following line in /etc/default/grub:
```console
GRUB_ENABLE_CRYPTODISK=y
```

### (iii) Add Command Line Parameters
In /etc/default/grub edit the following argument:
```console
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash sysrq_always_enabled=1 fbcon=nodefer cryptdevice=UUID=disk-UUID:cryptroot root=LABEL=root rootflags=subvol=@ rw loglevel=3"
```

### (iii) Create List of modules for Grub

I have excluded apple filesystem and raid, check the ubuntu grub secure boot script in the reference:

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

### (iv) Install grub on ESP (EFI System Partition)

```console
# grub-install --target=x86_64-efi --efi-directory=/boot/efi --modules=${GRUB_MODULES} --disable-shim-lock
```

### (v) Generate Config

```console
# grub-mkconfig -o /boot/grub/grub.cfg
```

## 19. Avoiding having to enter the passphrase twice

Create keyfile and add it:
```console
# dd bs=512 count=4 if=/dev/random of=/root/cryptlvm.keyfile iflag=fullblock
# chmod 000 /root/cryptlvm.keyfile
# cryptsetup -v luksAddKey /dev/sda3 /root/cryptlvm.keyfile
```

Edit /etc/mkinitcpio.conf:
```console
FILES=(/root/cryptlvm.keyfile)
```

Generate initramfs:
```console
# mkinitcpio -P
```

Secure embedded keyfile:
```console
# chmod 600 /boot/initramfs-linux*
```

Edit /etc/default/grub and add cryptkey=rootfs:/root/cryptlvm.keyfile in kernel params:
```console
GRUB_CMDLINE_LINUX_DEFAULT="...cryptkey=rootfs:/root/cryptlvm.keyfile..."
```

Regenerate grub config:
```console
# grub-mkconfig -o /boot/grub/grub.cfg
```

## 20. Secure boot setup

### (i) Install Secure Boot

```console
# pacman -Syyu sbctl
```

### (ii) Create Secure boot keys

```console
# sbctl create-keys
```

### (iii) Enroll keys

Change attributes of keys in btrfs:
```console
# chattr -i /sys/firmware/efi/efivars/{PK,KEK,db}*
```
In the above command, if either of PK,KEK or db causes command to fail remove that from the list and run with the rest.

Now, Enroll keys along with Microsoft keys (-m):
```console
# sbctl enroll-keys -m
```

### (iv) Sign Bootloader for Secureboot

```console
# sbctl sign -s -o /boot/efi/EFI/arch/grubx64.efi /boot/efi/EFI/arch/grubx64.efi
# sbctl sign -s -o /boot/vmlinuz-linux /boot/vmlinuz-linux
```

## 21. Plymouth Setup

### (i) Install plymouth
```console
# pacman -Syy plymouth
```

### (ii) Install plymouth theme

```console
$ yay -Syy plymouth-theme-bgrt-better-luks 
```

### (iii) Set Plymouth theme
Show installed plymouth themes:
```console
# plymouth-set-default-theme -l
```

Set plymouth theme:
```console
# plymouth-set-default-theme -R bgrt-better-luks
```

### (iv) Run mkinitcpio
```console
# mkinitcpio -P
```

## 23. Finish Install

Logout of user USERNAME, exit arch-chroot, unmount and reboot:
```console
$ exit
# exit
# umount -a
# reboot
```

Turn on secure boot in BIOS after this. Nothing else needed for Secure Boot.

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
