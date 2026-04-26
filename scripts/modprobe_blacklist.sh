# blacklist pata_acpi that is unused and to prevent kernel logs:
# workqueue: ata_sff_pio_task hogged CPU for >10000us 4 times, consider switching to WQ_UNBOUND
echo "blacklist pata_acpi" | sudo tee -a /etc/modprobe.d/rbx-blacklist.conf
# i8042 PS/2 controller, unused in vm
echo "blacklist i8042" | sudo tee -a /etc/modprobe.d/rbx-blacklist.conf
# trackpoint, unused in vm
echo "blacklist psmouse" | sudo tee -a /etc/modprobe.d/rbx-blacklist.conf
# blacklisting floppy, unused in vm
echo 'blacklist floppy' > /etc/modprobe.d/blacklist-floppy.conf
update-initramfs -u
