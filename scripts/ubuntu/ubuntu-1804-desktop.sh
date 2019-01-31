apt-get install -y ubuntu-desktop
rm /etc/network/if-pre-up.d/wpasupplicant || echo "No wpasupplicant file"
systemctl set-default graphical
