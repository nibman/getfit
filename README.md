PRE-REQUISITE:

  - node.js http://nodejs.org/, tested on v 0.10.xx
  - node-gyp package for building native modules https://npmjs.org/package/node-gyp
  - ANT USB2 Wireless Stick nRF24AP2-USB-ANT http://www.nordicsemi.com/eng/Products/ANT/nRF24AP2-USB

Windows-development:

  - LIBUSB-drivers, i.e Windows platform : Zadig http://sourceforge.net/projects/libwdi/files/zadig/
  - Visual Studio Desktop Express 2012 C++ compiler/IDE
  
DEPENDENT-LIBRARIES

  - Interface for LIBUSB - <b>usb</b> https://github.com/nonolith/node-usb
  - Websocket - <b>ws</b> https://github.com/einaros/ws
  
Tested on Windows 8 <b>X64</b>, may work on Linux/Mac/win32 with recompilation of native libraries

BUILDING/INSTALLING NATIVE LIBRARIES WITH VISUAL STUDIO DESKTOP 2012 EXPRESS

Based on info. from http://stackoverflow.com/questions/14278417/cannot-install-node-modules-that-require-compilation-on-windows-7-x64-vs2012

npm install usb --msvs_version=2012e
or
node-gyp rebuild --msvs_version=2012e

POWERSHELL:

Instead of using the msvs_version option for node-gyp, the GYP_MSVS_VERSION environment variable can be set to 2012e/2012 for the 
user/machine-profile to make this permanent.

  [Environment]::SetEnvironmentVariable("GYP_MSVS_VERSION","2012e","User")
  
Restart powershell to activate. 

The detailed algorithm for detecting visual studio versions is available at; https://github.com/TooTallNate/node-gyp/blob/master/gyp/pylib/gyp/MSVSVersion.py#L200-L265

USAGE:

<b>node getfit</b> 

  listen for LINK broadcasts from an ANT-FS enabled device i.e FR910 XT/610 and downloads new files
  
<b>node getfit -d 10</b>

  downloads file at index 10
  
<b>node getfit -d</b> 

  list device directory
  
<b>node getfit -b</b>

  uses background scanning channel for ANT+ and establishes a channel when a new device/master is found. Data is written to websocket
  on i.e localhost:8093 (hostname/port can be change by editing configuration.json)
  
<b>node getfit -c</b>

  uses a continous scanning channel for ANT+ and writes data to websocket on i.e localhost:8093
  
<b>node getfit -e 10</b>

  erase file at index 10
  
Support for visualizing data from sensors are available using "Live stream" in FITView https://github.com/hkskoglund/FITView or http://fitview.azurewebsites.net.
Currently testing has been done on device profile for HRM, SDM4 and SPDCAD (GSC-10). SDM4 sends background pages with
sensor health and battery status. A low battery is visualized with an icon and SDM health statues other than OK will be
reported. If FIT settings are imported into FITView, <i>calibration</i> factors for bike wheelsize or footpod is taken into account
when calculating speed and distance.

<b>configuration.json</b>

JSON file for configuration of ANT+/ANT-FS network keys, websocket server hostname and port, and usb vendor/product id.
