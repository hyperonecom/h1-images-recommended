apt-get install -y ubuntu-desktop
systemctl set-default graphical
systemctl disable avahi-daemon
systemctl disable cups
systemctl disable cups-browsed