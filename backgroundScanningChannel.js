"use strict";

var DeviceProfile = require('./deviceProfile.js');
var CRC = require('./crc.js');
var ANT = require('./ant-lib');
var fs = require('fs');
var Channel = require('./channel.js');
var Network = require('./network.js');

function BackgroundScanningChannel(nodeInstance) {
    DeviceProfile.call(this); 
    this.nodeInstance = nodeInstance;
}

BackgroundScanningChannel.prototype = DeviceProfile.prototype;  

BackgroundScanningChannel.constructor = BackgroundScanningChannel;  

BackgroundScanningChannel.prototype = {
};

module.exports = BackgroundScanningChannel;