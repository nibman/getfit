PRE-REQUISITE:

  - node.js http://nodejs.org/, tested on v 0.10.xx
  - bindings https://npmjs.org/package/bindings
  - ANT USB2 Wireless Stick nRF24AP2-8CH-ANT http://www.nordicsemi.com/eng/Products/ANT/nRF24AP2-8CH
  - LIBUSB-drivers, i.e Windows platform : Zadig http://sourceforge.net/projects/libwdi/files/zadig/
  
DEPENDENT-LIBRARIES

  - node usb https://github.com/nonolith/node-usb
  - ws https://github.com/einaros/ws
  
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
  localhost:8093 based on device profile i.e HRM/SDM4 or SPDCAD
  
node getFIT -c

  uses a continous scanning channel for ANT+ and writes data to websocket on localhost:8093 based on deviceprofile
  
node getFIT -e 10

  erase file at index 10
