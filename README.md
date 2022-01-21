# Evo_Sabre_Volumio3 Beta release
This is a quick test release. It is intended to be used on a fresh non-customized Volumio3 image. 

Do not use this on a system that has been modified before. 

Here is the testing procedure : 
* Download a fresh Volumio image and flash it on a SD card.
* Boot the SD card into your EVO Sabre.
* Open the WebUi and go through the first-boot wizard. 
  * When asked, tell the system you have a I2S DAC and select Audiophonics I-Sabre ES9028Q2M in the dropdown menu. 
  * The system will ask you to reboot but as far as testing this plugin is concerned, it does not really matter if you decide to reboot later.
* Go to volumio/dev and enable SSH.

* Use a SSH client on a computer located in the same network to connect to the Evo Sabre. 
* Once loggued into SSH do the following : 
```
git clone -b beta_release --single-branch https://github.com/audiophonics/Evo_Sabre_Volumio3.git
cd Evo_Sabre_Volumio3
sudo apt-get update
sudo apt-get install unzip
unzip audiophonics_evo_sabre.zip
volumio plugin install
```

After a minute or two the terminal should print this message : 
```
Done! Plugin Successfully Installed
```

* Then go back to the WebUi 
* Open the plugin tab -> installed plugins
* Enable Audiophonics Evo Sabre Plugin

At this point the rightmost display should turn on and react to whatever happens in playback.
The remote should be operationnal after a reboot.
