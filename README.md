PRE-REQUISITE:

  - node.js http://nodejs.org/, tested on v 0.10.xx
  - bindings https://npmjs.org/package/bindings
  - ANT USB2 Wireless Stick nRF24AP2-USB-ANT http://www.nordicsemi.com/eng/Products/ANT/nRF24AP2-USB
  - LIBUSB-drivers, i.e Windows platform : Zadig http://sourceforge.net/projects/libwdi/files/zadig/
  
DEPENDENT-LIBRARIES

  - Interface for LIBUSB - node usb https://github.com/nonolith/node-usb
  - Websocket - ws https://github.com/einaros/ws
  
Tested on Windows 8 only, may work on Linux/Mac with recompilation of native libraries

USAGE:

<b>node getfit</b> 

  listen for LINK broadcasts from an ANT-FS enabled device i.e FR910 XT/610 and downloads new files
  
<b>node getfit -d 10</b>

  downloads file at index 10
  
<b>node getfit -d</b> 

  list device directory
  
<b>node getFIT -b</b>

  uses background scanning channel for ANT+ and establishes a channel when a new device/master is found. Data is written to websocket
  on i.e localhost:8093 (hostname/port can be change by editing configuration.json)
  
<b>node getFIT -c</b>

  uses a continous scanning channel for ANT+ and writes data to websocket on i.e localhost:8093
  
<b>node getFIT -e 10</b>

  erase file at index 10
  
Support for visualizing data from sensors are available using "Live stream" in FITView https://github.com/hkskoglund/FITView or http://fitview.azurewebsites.net.
Currently testing has been done on device profile for HRM, SDM4 and SPDCAD (GSC-10). SDM4 sends background pages with
sensor health and battery status. A low battery will be visualized with an icon and SDM health statues other than OK will be
reported. If FIT settings are imported into FITView, calibration factors for bike wheelsize or footpod is taken into account
when calculating speed and distance.

<b>configuration.json</b>

JSON file for configuration of ANT+/ANT-FS network keys and websocket server hostname and port.
