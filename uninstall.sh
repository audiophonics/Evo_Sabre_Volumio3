#!/bin/bash

# Uninstall dependendencies
# apt-get remove -y 
systemctl stop evo_oled2	
rm /etc/systemd/system/evo_oled2.service

systemctl stop lircd
systemctl stop irexec
rm /etc/lirc/lircrc
apt-get -y purge --auto-remove lirc

echo "Done"
echo "pluginuninstallend"