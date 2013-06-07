var DeviceProfile = require('./deviceProfile.js');
var Channel = require('./channel.js');
var Network = require('./network.js');
var ANT = require('./ant-lib');

function DeviceProfile_SPDCAD() {
    DeviceProfile.call(this); // Call parent
}

DeviceProfile_SPDCAD.protype = DeviceProfile.prototype;  // Inherit properties/methods

DeviceProfile_SPDCAD.constructor = DeviceProfile_SPDCAD;  // Update constructor

DeviceProfile_SPDCAD.prototype = {

    DEVICE_TYPE: 0x79, // 121
    CHANNEL_PERIOD: 8086,

    getSlaveChannelConfiguration: function (networkNr, channelNr, deviceNr, transmissionType, searchTimeout) {

        var channel = new Channel(channelNr, Channel.prototype.CHANNEL_TYPE.receive_channel, networkNr, Network.prototype.NETWORK_KEY.ANT);

        channel.setChannelId(deviceNr, DeviceProfile_SPDCAD.prototype.DEVICE_TYPE, transmissionType, false);
        channel.setChannelPeriod(DeviceProfile_SPDCAD.prototype.CHANNEL_PERIOD); // ca. 4.05 Hz
        channel.setChannelSearchTimeout(searchTimeout);
        channel.setChannelFrequency(ANT.prototype.ANT_FREQUENCY);

        channel.nodeInstance = this.nodeInstance; // Attach channel to nodeInstance
        channel.deviceProfile = this; // Attach deviceprofile to channel
        this.channel = channel; // Attach channel to device profile

        channel.channelResponseEvent = this.channelResponseEvent || DeviceProfile.prototype.channelResponseEvent;
        channel.broadCastDataParser = this.broadCastDataParser || DeviceProfile.prototype.broadCastDataParser;

        return channel;

    },

    broadCastDataParser: function (data) {
        console.log(Date.now() + " SPDCAD broad cast data ", data);
    }
};

module.exports = DeviceProfile_SPDCAD;