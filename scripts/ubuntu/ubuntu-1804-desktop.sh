apt-get install -y ubuntu-desktop arping --no-install-recommends
rm /etc/network/if-pre-up.d/wpasupplicant || echo "No wpasupplicant file"
systemctl set-default graphical
