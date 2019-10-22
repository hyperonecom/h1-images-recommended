apt-get purge ubuntu-release-upgrader-core python3-distupgrade;
apt-get install -y ubuntu-desktop arping;
rm /etc/network/if-pre-up.d/wpasupplicant || echo "No wpasupplicant file";
systemctl set-default graphical