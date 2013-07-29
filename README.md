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

node getFIT 

  listen for LINK broadcasts from an ANT-FS enabled device i.e FR910 XT/610 and downloads new files
  
node getFIT -d 10

  downloads file at index 10
  
node getFIT -d 

  list device directory
  
node getFIT -b

  uses background scanning channel for ANT+ and establishes a channel when a new device/master is found. Data is written to websocket
  on websocket at i.e localhost:8093 (hostname/port can be change by editing configuration.json)
  
node getFIT -c

  uses a continous scanning channel for ANT+ and writes data to websocket on i.e localhost:8093
  
node getFIT -e 10

  erase file at index 10
  
Support for visualizing data from sensors are available using "Live stream" in FITView https://github.com/hkskoglund/FITView or http://fitview.azurewebsites.net.
Currently testing has been done on device profile for HRM, SDM4 and SPDCAD (GSC-10). SDM4 sends background pages with
sensor health and battery status. A low battery will be visualized with an icon. as well as SDM health statues other than OK.
