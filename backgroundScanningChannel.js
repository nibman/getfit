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

    getSlaveChannelConfiguration: function (networkNr, channelNr, deviceNr, deviceType, transmissionType, lowPrioritySearchTimeout) {
        // Setup channel parameters for background scanning
        this.channel = new Channel(channelNr, Channel.prototype.CHANNEL_TYPE.receive_only_channel, networkNr, Network.prototype.NETWORK_KEY.ANT);

        this.channel.setExtendedAssignment(ANT.prototype.EXTENDED_ASSIGNMENT.BACKGROUND_SCANNING_ENABLE);
        this.channel.setChannelId(deviceNr, deviceType, transmissionType, false);
        this.channel.setChannelPeriod(DeviceProfile_ANTFS.prototype.CHANNEL_PERIOD);
        this.channel.setLowPrioritySearchTimeout(lowPrioritySearchTimeout);
        this.channel.setChannelSearchTimeout(0); // Disable High priority search
        this.channel.setChannelFrequency(ANT.prototype.ANT_FREQUENCY);
        //this.channel.setChannelSearchWaveform(DeviceProfile_ANTFS.prototype.SEARCH_WAVEFORM);

        // Functions available as callbacks
        this.channel.broadCastDataParser = this.broadCastDataParser || DeviceProfile.prototype.broadCastDataParser;
       // this.channel.parseBurstData = this.parseBurstData || DeviceProfile.prototype.parseBurstData; // Called on a complete aggregation of burst packets
        this.channel.channelResponseEvent = this.channelResponseEvent || DeviceProfile.prototype.channelResponseEvent;

        this.channel.addListener(Channel.prototype.EVENT.CHANNEL_RESPONSE_EVENT, this.channel.channelResponseEvent);
        this.channel.addListener(Channel.prototype.EVENT.BROADCAST, this.channel.broadCastDataParser);
        //this.channel.addListener(Channel.prototype.EVENT.BURST, this.channel.parseBurstData);

        this.channel.nodeInstance = this.nodeInstance; // Attach channel to nodeInstance
        //this.channel.deviceProfile = this; // Attach channel to device profile

        return this.channel;
    },
};

module.exports = BackgroundScanningChannel;