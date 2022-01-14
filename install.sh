#!/bin/bash

echo "Installing display OLED#2" 

echo "Creating Systemd service for OLED#2 in /etc/systemd/system/evo_oled2.service"
printf "[Unit]
Description=OLED Display Service for EVO SABRE
After=volumio.service
[Service]
WorkingDirectory=/data/plugins/system_hardware/audiophonics_evo_sabre/app
ExecStart=$(which sudo) $(which node) /data/plugins/system_hardware/audiophonics_evo_sabre/app/index.js volumio
StandardOutput=null
KillSignal=SIGINT 
Type=simple
User=root
[Install]
WantedBy=multi-user.target"> /etc/systemd/system/evo_oled2.service
systemctl daemon-reload

echo "OLED#2 service created ( /etc/systemd/system/evo_oled2.service )"

echo "Installing remote control" 

# This package of LIRC comes with about 80mb of GUI deps and we don't want any of that.
apt-get update
apt-get install -y lirc gir1.2-vte- libyaml-0-2- python3-gi- python3-yaml-

# Expose gpio-ir kernel driver
if ! grep -q "dtoverlay=gpio-ir,gpio_pin=4" "/boot/userconfig.txt"; then
    echo "dtoverlay=gpio-ir,gpio_pin=4"  >> /boot/userconfig.txt
fi

# Not sure how to get a clean reliable path to the freshly installed configuration files from there.
# Until I find a better way let's extract it from the ENV SUDO_COMMAND variable with sed.
install_path=`echo $SUDO_COMMAND | sed  "s/^.*\s\(.*\).*install.sh/\1/"`
rsync -a ${install_path}lirc_config/ /etc/lirc/

#requred to end the plugin install
echo "plugininstallend"
