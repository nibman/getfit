var DeviceProfile = require('./deviceProfile.js');
var Channel = require('./channel.js');
var Network = require('./network.js');
var ANT = require('./ant-lib');

function DeviceProfile_SPDCAD(nodeInstance) {
    DeviceProfile.call(this, nodeInstance); // Call parent
    this.nodeInstance = nodeInstance;
}

DeviceProfile_SPDCAD.protype = DeviceProfile.prototype;  // Inherit properties/methods

DeviceProfile_SPDCAD.constructor = DeviceProfile_SPDCAD;  // Update constructor

DeviceProfile_SPDCAD.prototype = {

    NAME : 'SPDCAD',

    DEVICE_TYPE: 0x79, // 121

    CHANNEL_PERIOD: 8086,

    WHEEL_CIRCUMFERENCE : 2096, // in mm. -> should be able to configure in a file...

    getSlaveChannelConfiguration: function (networkNr, channelNr, deviceNr, transmissionType, searchTimeout) {

        var channel = new Channel(channelNr, Channel.prototype.CHANNEL_TYPE.receive_channel, networkNr, Network.prototype.NETWORK_KEY.ANT, this.nodeInstance.STARTUP_DIRECTORY);

        channel.setChannelId(deviceNr, DeviceProfile_SPDCAD.prototype.DEVICE_TYPE, transmissionType, false);
        channel.setChannelPeriod(DeviceProfile_SPDCAD.prototype.CHANNEL_PERIOD); // ca. 4.05 Hz
        channel.setChannelSearchTimeout(searchTimeout);
        channel.setChannelFrequency(ANT.prototype.ANT_FREQUENCY);

        channel.nodeInstance = this.nodeInstance; // Attach channel to nodeInstance
        channel.deviceProfile = this; // Attach deviceprofile to channel
        this.channel = channel; // Attach channel to device profile

        channel.channelResponseEvent = this.channelResponseEvent || DeviceProfile.prototype.channelResponseEvent;
        channel.broadCastDataParser = this.broadCastDataParser || DeviceProfile.prototype.broadCastDataParser;

        this.channel.addListener(Channel.prototype.EVENT.CHANNEL_RESPONSE_EVENT, this.channel.channelResponseEvent);
        this.channel.addListener(Channel.prototype.EVENT.BROADCAST, this.channel.broadCastDataParser);

        return channel;

    },

    broadCastDataParser: function (data) {
       // console.log(Date.now() + " SPDCAD broad cast data ", data);

        var receivedTimestamp = Date.now(),
           self = this,// Will be cannel configuration

        // 0 = SYNC, 1= Msg.length, 2 = Msg. id (broadcast), 3 = channel nr , 4= start of page  ...
         startOfPageIndex = 4,

         dataPageNumber = 0,

         prevPage,

         page = {

             bikeCadenceEventTime: data.readUInt16LE(startOfPageIndex), // 1/1024 seconds - rollover 64 seconds
             cumulativeCadenceRevolutionCount: data[startOfPageIndex + 2], // Rollover 65535

             bikeSpeedEventTime: data.readUInt16LE(startOfPageIndex + 4), // 1/1024 seconds - rollover 64 seconds
             cumulativeSpeedRevolutionCount: data.readUInt16LE(startOfPageIndex + 6)
         };

        // Add header
        page.dataPageNumber = dataPageNumber, // Combined cadence/speed only has page 0 
        page.timestamp = receivedTimestamp,
        //deviceType: DeviceProfile_HRM.prototype.DEVICE_TYPE,  // Should make it possible to classify which sensors data comes from
        page.channelID = this.channelID,  // Channel ID is already contained in data, but its already parsed in the ANT library (parse_response func.)

        page.constructor.prototype.toString = function () {
            var msg =  "Cadence event time " + this.bikeCadenceEventTime / 1024 + " s" +
                " Count " + this.cumulativeCadenceRevolutionCount +
                " Speed event time " + this.bikeSpeedEventTime / 1024 + " s" +
                " Count " + this.cumulativeSpeedRevolutionCount;

            if (this.cadence)
                msg += " Cadence " + this.cadence.toFixed(0) +" RPM";

            if (this.speed)
                msg += " Speed " + this.speed.toFixed(2) + " m/s";

            if (this.distance)
                msg += " Distance " + this.distance + " m";

            return msg;
        }

        if (typeof this.channelID === "undefined")
            console.log(Date.now(), "No channel ID found for this master, every master has a channel ID, verify that channel ID is set (should be set during parse_response in ANT lib.)");

        if (typeof this.channelIDCache[this.channelID.toProperty] === "undefined") {
            console.log(Date.now(), "Creating object in channelIDCache to store previous page for master with channel Id", this.channelID);
            this.channelIDCache[this.channelID.toProperty] = {};

        }

        prevPage = this.channelIDCache[this.channelID.toProperty].previousPage;

        //if (prevPage)
        //  console.log(prevPage.bikeCadenceEventTime, page.bikeCadenceEventTime);

        if (prevPage && prevPage.bikeCadenceEventTime !== page.bikeCadenceEventTime) {  // Filter out identical messages, i.e crank revolving slowly
            
            // ANT+ Managed Network Document - Bike Speed and Cadence Device Profile , p. 29

            var rollOverCadenceTime = (prevPage.bikeCadenceEventTime > page.bikeCadenceEventTime) ? true : false,
                rollOverCadenceRevolution = (prevPage.cumulativeCadenceRevolutionCount > page.cumulativeCadenceRevolutionCount) ? true : false,
                revolutionCountDifference,
                measurementTimeDifference;

            if (rollOverCadenceTime)
                page.measurementCadenceTimeDifference = (0xFFFF - prevPage.bikeCadenceEventTime) + page.bikeCadenceEventTime;
            else
                page.measurementCadenceTimeDifference = page.bikeCadenceEventTime - prevPage.bikeCadenceEventTime;

            if (rollOverCadenceRevolution)
                page.revolutionCadenceCountDifference = (0xFFFF - prevPage.cumulativeCadenceRevolutionCount) + page.cumulativeCadenceRevolutionCount;
            else
                page.revolutionCadenceCountDifference = page.cumulativeCadenceRevolutionCount - prevPage.cumulativeCadenceRevolutionCount;

            page.cadence = 60 * page.revolutionCadenceCountDifference * 1024 / page.measurementCadenceTimeDifference;
           
        }

        if (prevPage && prevPage.bikeSpeedEventTime !== page.bikeSpeedEventTime) {  // Filter out identical messages, i.e wheel revolving slowly
            
            // ANT+ Managed Network Document - Bike Speed and Cadence Device Profile , p. 29

            var rollOverSpeedTime = (prevPage.bikeSpeedEventTime > page.bikeSpeedEventTime) ? true : false,
                rollOverSpeedRevolution = (prevPage.cumulativeSpeedRevolutionCount > page.cumulativeSpeedRevolutionCount) ? true : false,
                revolutionSpeedCountDifference,
                measurementSpeedTimeDifference;

            if (rollOverSpeedTime)
                page.measurementSpeedTimeDifference = (0xFFFF - prevPage.bikeCadenceEventTime) + page.bikeCadenceEventTime;
            else
                page.measurementSpeedTimeDifference = page.bikeSpeedEventTime - prevPage.bikeSpeedEventTime;

            if (rollOverSpeedRevolution)
                page.revolutionSpeedCountDifference = (0xFFFF - prevPage.cumulativeSpeedRevolutionCount) + page.cumulativeSpeedRevolutionCount;
            else
                page.revolutionSpeedCountDifference = page.cumulativeSpeedRevolutionCount - prevPage.cumulativeSpeedRevolutionCount;

            // ANT+ Managed Network Document - Bike Speed and Cadence Device Profile , p. 20

            page.speed = (DeviceProfile_SPDCAD.prototype.WHEEL_CIRCUMFERENCE / 1000) * page.revolutionSpeedCountDifference * 1024 / page.measurementSpeedTimeDifference;

            // accumulated distance between measurements
            page.wheelCircumference = DeviceProfile_SPDCAD.prototype.WHEEL_CIRCUMFERENCE;
            page.accumulatedDistance = (DeviceProfile_SPDCAD.prototype.WHEEL_CIRCUMFERENCE / 1000) * page.revolutionSpeedCountDifference;

        }

        if (page.cadence || page.speed) {
            console.log(Date.now(), page.toString());
            this.nodeInstance.broadCastOnWebSocket(JSON.stringify(page)); // Send to all connected clients
        }

        this.channelIDCache[this.channelID.toProperty].previousPage = page;

            //console.log(Date.now(), page);
       
    }
};

module.exports = DeviceProfile_SPDCAD;