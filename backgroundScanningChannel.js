"use strict";

var DeviceProfile = require('./deviceProfile.js');
var DeviceProfile_HRM = require('./deviceProfile_HRM.js');
var DeviceProfile_SDM = require('./deviceProfile_SDM.js');
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

    getSlaveChannelConfiguration: function (networkNr, channelNr, deviceNr, deviceType, transmissionType, lowPrioritySearchTimeout, startupDirectory, frequency ,key) {
        // Setup channel parameters for background scanning
        //console.log("Low priority search timeout", lowPrioritySearchTimeout);
        this.channel = new Channel(channelNr, Channel.prototype.CHANNEL_TYPE.receive_only_channel, networkNr, key, startupDirectory);

        this.channel.setExtendedAssignment(Channel.prototype.EXTENDED_ASSIGNMENT.BACKGROUND_SCANNING_ENABLE);
        this.channel.setChannelId(deviceNr, deviceType, transmissionType, false);
        //this.channel.setChannelPeriod(DeviceProfile_ANTFS.prototype.CHANNEL_PERIOD);
        this.channel.setLowPrioritySearchTimeout(lowPrioritySearchTimeout);
        this.channel.setChannelSearchTimeout(0); // Disable High priority search
        this.channel.setChannelFrequency(frequency);
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
        //console.log(this.channel);
        return this.channel;
    },

    broadCastDataParser: function (data) {
        //console.log(Date.now() + " Background scanning channel BROADCAST : ", data, this.channelID);
        //channelID:
        //    { channelNumber: 0,
        //        deviceNumber: 51144,
        //        deviceTypeID: 124,
        //        transmissionType: 1,
        // TO DO : open channel for  this.channelID device profile

        var deviceProfile,
            self = this;

        var openChannel = function (channelNr) {
            self.nodeInstance.ANT.setChannelConfiguration(channelNr, deviceProfile.getSlaveChannelConfiguration(Network.prototype.ANT,
                    channelNr, self.channelID.deviceNumber, self.channelID.transmissionType, ANT.prototype.SEARCH_TIMEOUT.INFINITE));
            self.nodeInstance.ANT.activateChannelConfiguration(channelNr, function error(err) { console.log(Date.now(), "Could not activate channel configuration", err); },
                function successCB(data) {
                    self.nodeInstance.ANT.open(channelNr, function error(err) { console.log(Date.now(), "Could not open channel", self.channelID, err); },
                            function success(data) {
                                console.log(Date.now(), "Channel open for profile "+deviceProfile.NAME);
                            }
                            , true);
                });
        }

        switch (this.channelID.deviceTypeID) {

            case DeviceProfile_HRM.prototype.DEVICE_TYPE:

                // By convention when a master is found and a new channel is created/opened to handle broadcasts,
                // the background channel search will not trigger anymore on this master

                console.log(Date.now(), "Found HRM - heart rate monitor - device",this.channelID);

                deviceProfile = new DeviceProfile_HRM(this.nodeInstance);
                openChannel(1);

                break;

            case DeviceProfile_SDM.prototype.DEVICE_TYPE:

                console.log(Date.now(), "Found SDM4 - foot pod - device", this.channelID);
                deviceProfile = new DeviceProfile_SDM(this.nodeInstance);
                openChannel(2);

                break;

            default:
                console.log(Date.now() + "Not implemented support for device type " + this.channelID.deviceTypeID);
                break;
        }
        
    },

    channelResponseEvent: function (data) {
        console.log(Date.now() + " Background scanning channel RESPONSE/EVENT : ", data);
    }
};

module.exports = BackgroundScanningChannel;