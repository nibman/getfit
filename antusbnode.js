// Some info. from : https://github.com/Tigge/Garmin-Forerunner-610-Extractor

var usb = require('./usb');

var log = true;

// Based on https://developer.mozilla.org/en-US/docs/JavaScript/Introduction_to_Object-Oriented_JavaScript
function DeviceProfile(nodeInstance) {
    this.nodeInstance = nodeInstance;
}

DeviceProfile.prototype = {

    DEVICE_TYPE: 0x00,

    channelResponseEvent: function (data) {
        console.log("Channel response/event : ", data);
        //return "Not defined";
    },

    getSlaveChannelConfiguration: function () {
        return "Not defined";
    },

    getMasterChannelConfiguration : function () {
        return "Not defined";
    }
}

function DeviceProfile_HRM(nodeInstance)
{
    DeviceProfile.call(this, nodeInstance); // Call parent
    this.nodeInstance = nodeInstance;
   
}

DeviceProfile_HRM.protype = DeviceProfile.prototype;  // Inherit properties/methods

DeviceProfile_HRM.constructor = DeviceProfile_HRM;  // Update constructor

DeviceProfile_HRM.prototype = {

    DEVICE_TYPE: 0x78,

    CHANNEL_PERIOD: 8070,

    // Override/"property shadowing"
    getSlaveChannelConfiguration: function (networkNr, channelNr, deviceNr, transmissionType, searchTimeout) {
        // ANT+ Managed Network Document – Heart Rate Monitor Device Profile  , p . 9  - 4 channel configuration

        var channel = new Channel(channelNr, Channel.prototype.CHANNEL_TYPE.receive_channel, networkNr, Network.prototype.NETWORK_KEY.ANT);

        channel.setChannelId(deviceNr, DeviceProfile_HRM.prototype.DEVICE_TYPE, transmissionType, false);

        channel.setChannelPeriod(DeviceProfile_HRM.prototype.CHANNEL_PERIOD); // Ca. 4 messages pr. second, or 1 msg. pr 246.3 ms -> max HR supported 246.3 pr/minute 
        channel.setChannelSearchTimeout(searchTimeout);
        channel.setChannelFrequency(ANT.prototype.ANT_FREQUENCY);

        channel.broadCastDataParser = this.broadCastDataParser || DeviceProfile.prototype.broadCastDataParser; // Called on received broadcast data

        channel.nodeInstance = this.nodeInstance; // Attach channel to nodeInstance
        channel.deviceProfile = this; // Attach deviceprofile to channel
        
       
        this.channel = channel; // Attach channel to device profile
        this.channel.channelResponseEvent = this.channelResponseEvent || DeviceProfile.prototype.channelResponseEvent;

        return channel;

    },

    lostBroadCastData : function ()
    {
        console.log("Lost broadcast data from HRM"); 
    },


    broadCastDataParser: function (data) {
        var receivedTimestamp = Date.now(),
            self = this;// Will be cannel configuration


        // 0 = SYNC, 1= Msg.length, 2 = Msg. id (broadcast), 3 = channel nr , 4= start of page  ...
        var startOfPageIndex = 4;
       // console.log(Date.now() + " HRM broadcast data ", data);
        var pageChangeToggle = data[startOfPageIndex] & 0x80,
             dataPageNumber = data[startOfPageIndex] & 0x7F;
               
        //heart
        var page = {
            // Header

            timestamp: receivedTimestamp,
            deviceType : DeviceProfile_HRM.prototype.DEVICE_TYPE,  // Should make it possible to classify which sensors data comes from

            pageChangeToggle: pageChangeToggle,
            dataPageNumber: dataPageNumber,

            heartBeatEventTime: data.readUInt16LE(startOfPageIndex + 4),
            heartBeatCount : data[startOfPageIndex + 6],
            computedHeartRate: data[startOfPageIndex + 7],

           
        };
        
        switch (dataPageNumber) {

            case 4: // Main data page

                page.previousHeartBeatEventTime = data.readUInt16LE(startOfPageIndex + 2);
               

                var rollOver = (page.previousHeartBeatEventTime > page.heartBeatEventTime) ? true : false;

                if (rollOver)
                    page.RRInterval = (0xFFFF - page.previousHeartBeatEventTime) + page.heartBeatEventTime;
                else
                    page.RRInterval = page.heartBeatEventTime - page.previousHeartBeatEventTime;

                if (this.previousHeartBeatEventTime !== page.heartBeatEventTime) {  // Filter out identical messages
                    this.previousHeartBeatEventTime = page.heartBeatEventTime;
                    var msg = "HR " + page.computedHeartRate + " heart beat count " + page.heartBeatCount + " RR " + page.RRInterval;
                    console.log(msg);
                    

                    if (this.timeout) {
                        clearTimeout(this.timeout);
                        //console.log("After clearing", this.timeout);
                        delete this.timeout;
                    }

                    this.timeout = setTimeout(function () { self.deviceProfile.lostBroadCastData(); },3000);
                }
                break;

            case 2: // Background data page - sent every 65'th message

                page.manufacturerID = data[startOfPageIndex + 1];
                page.serialNumber = data.readUInt16LE(startOfPageIndex + 2);
              
                if (this.previousHeartBeatEventTime !== page.heartBeatEventTime) {
                    this.previousHeartBeatEventTime = page.heartBeatEventTime;
                    console.log("Manufacturer " + page.manufacturerID + " serial number : " + page.serialNumber);
                }
                
                break;

            case 3: // Background data page

                page.hardwareVersion = data[startOfPageIndex + 1];
                page.softwareVersion = data[startOfPageIndex + 2];
                page.modelNumber = data[startOfPageIndex + 3];

                if (this.previousHeartBeatEventTime !== page.heartBeatEventTime) {
                    this.previousHeartBeatEventTime = page.heartBeatEventTime;
                    console.log("HW version " + page.hardwareVersion + " SW version " + page.softwareVersion + " Model nr. " + page.modelNumber);
                }
              
               
                break;

            case 1: // Background data page

                page.cumulativeOperatingTime = (data.readUInt32LE(startOfPageIndex + 1) & 0x00FFFFFF) / 2; // Seconds since reset/battery replacement
                if (this.previousHeartBeatEventTime !== page.heartBeatEventTime) {
                    this.previousHeartBeatEventTime = page.heartBeatEventTime;
                    console.log("Cumulative operating time (s) " + page.cumulativeOperatingTime + " hours: " + page.cumulativeOperatingTime / 3600);
                }
               
                break;

            case 0: // Background - unknown data format
                break;

            default:

                console.log("Page ", dataPageNumber, " not implemented.");
                break;
        }

        this.nodeInstance.broadCast(JSON.stringify(page)); // Send to all connected clients
    }
};


function DeviceProfile_SDM(nodeInstance)
{
    DeviceProfile.call(this); // Call parent
    this.nodeInstance = nodeInstance;
}

DeviceProfile_SDM.protype = DeviceProfile.prototype;  // Inherit properties/methods

DeviceProfile_SDM.constructor = DeviceProfile_SDM;  // Update constructor

DeviceProfile_SDM.prototype = {

    DEVICE_TYPE: 0x7C,

    CHANNEL_PERIOD: 8134, // 4 hz

    ALTERNATIVE_CHANNEL_PERIOD: 16268,  // 2 Hz

    // Override/"property shadowing"
    getSlaveChannelConfiguration: function (networkNr, channelNr, deviceNr, transmissionType, searchTimeout) {

        var channel = new Channel(channelNr, Channel.prototype.CHANNEL_TYPE.receive_channel, networkNr, Network.prototype.NETWORK_KEY.ANT);

        channel.setChannelId(deviceNr, DeviceProfile_SDM.prototype.DEVICE_TYPE, transmissionType, false);

        channel.setChannelPeriod(DeviceProfile_SDM.prototype.CHANNEL_PERIOD); // Ca. 4 messages pr. second
        channel.setChannelSearchTimeout(searchTimeout);

        channel.setChannelFrequency(ANT.prototype.ANT_FREQUENCY);

        channel.broadCastDataParser = this.broadCastDataParser || DeviceProfile.prototype.broadCastDataParser; // Called on received broadcast data

        channel.nodeInstance = this.nodeInstance; // Attach channel to nodeInstance
        channel.deviceProfile = this; // Attach deviceprofile to channel
       

        this.channel = channel; // Attach channel to device profile
        this.channel.channelResponseEvent = this.channelResponseEvent  || DeviceProfile.prototype.channelResponseEvent;

        //console.log(channel);
        return channel;

    },

    broadCastDataParser: function (data) {
        //console.log(Date.now() + " SDM broadcast data ", data);
        var receivedTimestamp = Date.now(),
          self = this,
           UNUSED = 0x00,
           msg;// Will be cannel configuration


        // 0 = SYNC, 1= Msg.length, 2 = Msg. id (broadcast), 3 = channel nr , 4= start of page  ...
        var startOfPageIndex = 4;


        var page = {
            // Header
            dataPageNumber: data[startOfPageIndex] & 0x7F,

            timestamp: Date.now()
        };

        switch (page.dataPageNumber) {

            case 1: // Main page
                page.timeFractional = data[startOfPageIndex + 1] * (1 / 200), // s
                page.timeInteger = data[startOfPageIndex + 2],
                page.time = page.timeInteger + page.timeFractional;

                page.distanceInteger = data[startOfPageIndex + 3], // m
                page.distanceFractional = (data[startOfPageIndex + 4] & 0xF0) * (1 / 16), // Upper 4 bit
                page.distance = page.distanceInteger + page.distanceFractional;

                page.speedInteger = data[startOfPageIndex + 4] & 0x0F, // lower 4 bit
                page.speedFractional = data[startOfPageIndex + 5] * (1 / 256),   // m/s
                page.speed = page.speedInteger + page.speedFractional;

                page.strideCount = data[startOfPageIndex + 6],
                page.updateLatency = data[startOfPageIndex + 7] * (1 / 32) // s

                msg = "";
                if (page.time !== UNUSED)
                    msg += "Time : " + page.time + " s";
                else
                    msg += "Time : UNUSED";

                if (page.distance !== UNUSED)
                    msg += " Distance : " + page.distance + " m";
                else
                    msg += " Distance : UNUSED";

                if (page.speed !== UNUSED)
                    msg += " Speed : " + page.speed;
                else
                    msg += " Speed : UNUSED";

                msg += " Stride count : " + page.strideCount;

                if (page.updateLatency !== UNUSED)
                    msg += " Update latency : " + page.updateLatency + " s";
                else
                    msg += " Update latency : UNUSED";

                console.log(msg);

                break;

            case 2: // Base template 

                page.cadenceInteger = data[startOfPageIndex + 3] * (1 / 200), // s
               page.cadenceFractional = (data[startOfPageIndex + 4] & 0xF0) * (1 / 16);
                page.cadence = page.cadenceInteger + page.cadenceFractional;

                page.speedInteger = data[startOfPageIndex + 4] & 0x0F, // lower 4 bit
               page.speedFractional = data[startOfPageIndex + 5] * (1 / 256),   // m/s
               page.speed = page.speedInteger + page.speedFractional;

                page.status = {
                    SDMLocation: (data[startOfPageIndex + 7] & 0xC0) >> 7,
                    BatteryStatus: (data[startOfPageIndex + 7] & 0x30) >> 4,
                    SDMHealth: (data[startOfPageIndex + 7] & 0x0C) >> 2,
                    UseState: (data[startOfPageIndex + 7] & 0x03)
                };

                switch (page.status.SDMLocation) {
                    case 0x00: page.status.SDMLocationFriendly = "Laces"; break;
                    case 0x01: page.status.SDMLocationFriendly = "Midsole"; break;
                    case 0x02: page.status.SDMLocationFriendly = "Other"; break;
                    case 0x03: page.status.SDMLocationFriendly = "Ankle"; break;
                    default: page.status.SDMLocationFriendly = "? " + page.status.SDMLocation; break;
                }

                switch (page.status.BatteryStatus) {
                    case 0x00: page.status.BatteryStatusFriendly = "OK (new)"; break;
                    case 0x01: page.status.BatteryStatusFriendly = "OK (good)"; break;
                    case 0x02: page.status.BatteryStatusFriendly = "OK"; break;
                    case 0x03: page.status.BatteryStatusFriendly = "Low battery"; break;
                    default: page.status.BatteryStatusFriendly = "? " + page.status.BatteryStatus; break;
                }

                switch (page.status.SDMHealth) {
                    case 0x00: page.status.SDMHealthFriendly = "OK"; break;
                    case 0x01: page.status.SDMHealthFriendly = "Error"; break;
                    case 0x02: page.status.SDMHealthFriendly = "Warning"; break;
                    case 0x03: page.status.SDMHealthFriendly = "Reserved"; break;
                    default: page.status.SDMHealthFriendly = "? " + page.status.SDMHealth; break;
                }

                switch (page.status.UseState) {
                    case 0x00: page.status.UseStateFriendly = "Inactive"; break;
                    case 0x01: page.status.UseStateFriendly = "Active"; break;
                    case 0x02: page.status.UseStateFriendly = "Reserved"; break;
                    case 0x03: page.status.UseStateFriendly = "Reserved"; break;
                    default: page.status.UseStateFriendly = "? " + page.status.UseState; break;
                }


                msg = "";
                if (page.cadence !== UNUSED)
                    msg += "Cadence : " + page.cadence + " strides/min ";
                else
                    msg += "Cadence : UNUSED";

                if (page.speed !== UNUSED)
                    msg += " Speed : " + page.speed;
                else
                    msg += " Speed : UNUSED";


                msg += " Location: " + page.status.SDMLocationFriendly + " Battery: " + page.status.BatteryStatusFriendly + " Health: " + page.status.SDMHealthFriendly + " State: " + page.status.UseStateFriendly;

                console.log(msg);

                break;


            case 0x50: // 80 Common data page

                page.HWRevision = data[startOfPageIndex + 3];
                page.manufacturerID = data.readUInt16LE(4);
                page.modelNumber = data.readUInt16LE(6);

                console.log("HW revision: " + page.HWRevision + " Manufacturer ID: " + page.manufacturerID + " Model nr. : " + page.modelNumber);

                break;

            case 0x51: // 81 Common data page

                page.SWRevision = data[startOfPageIndex + 3];
                page.serialNumber = data.readUInt32LE(4);

                if (page.serialNumber === 0xFFFFFFFF)
                    console.log("SW revision : " + page.SWRevision + " No serial number");
                else
                    console.log("SW revision : " + page.SWRevision + " Serial number: " + page.serialNumber);

                break;

            case 0x52: // 82 Common data page - Battery Status
                //console.log("Battery status : ",data);
                page.descriptive = {
                    coarseVoltage: data[startOfPageIndex + 7] & 0x0F,        // Bit 0-3
                    batteryStatus: (data[startOfPageIndex + 7] & 0x70) >> 4, // Bit 4-6
                    resoultion: (data[startOfPageIndex + 7] & 0x80) >> 7 // Bit 7 0 = 16 s, 1 = 2 s
                }

                var divisor = (page.resolution === 1) ? 2 : 16;
                

                page.cumulativeOperatingTime = (data.readUInt32LE(startOfPageIndex+3) & 0x00FFFFFF) / divisor; // 24 - bit only
                page.fractionalBatteryVoltage = data[startOfPageIndex + 6] / 256; // Volt
                if (page.descriptive.coarseVoltage === 0x0F)
                    page.batteryVoltage = "Invalid";
                else
                    page.batteryVoltage = page.fractionalBatteryVoltage + page.descriptive.coarseVoltage;

                msg = "";
                switch (page.descriptive.batteryStatus) {
                    case 0x00: msg += "Reserved"; break;
                    case 0x01: msg += "New"; break;
                    case 0x02: msg += "Good"; break;
                    case 0x03: msg += "OK"; break;
                    case 0x04: msg += "Low"; break;
                    case 0x05: msg += "Critical"; break;
                    case 0x06: msg += "Reserved"; break;
                    case 0x07: msg += "Invalid"; break;
                    default: msg += "? - " + page.descriptive.batteryStatus;
                }

                //console.log(page);

                console.log("Cumulative operating time (s): " + page.cumulativeOperatingTime + " Battery (V) " + page.batteryVoltage + " Battery status: " + msg);
                break;

            default:

                console.log("Page ", page.dataPageNumber, " not implemented.");
                break;
        }
    }
};



function DeviceProfile_ANTFS(nodeInstance) {
    DeviceProfile.call(this); // Call parent
    this.nodeInstance = nodeInstance;
    this.state = DeviceProfile_ANTFS.prototype.STATE.LINK_LAYER;
}

DeviceProfile_ANTFS.protype = DeviceProfile.prototype;  // Inherit properties/methods

DeviceProfile_ANTFS.constructor = DeviceProfile_ANTFS;  // Update constructor

DeviceProfile_ANTFS.prototype = {

    CHANNEL_PERIOD: 4096,

    SEARCH_WAVEFORM: [0x53, 0x00],

    BEACON_ID: 0x43,

    STATE: {
        LINK_LAYER: 0x00,
        AUTHENTICATION_LAYER: 0x01,
        TRANSPORT_LAYER: 0x02,
        BUSY: 0x03,
        0x00: "LINK State",
        0x01: "AUTHENTICATION State",
        0x02: "TRANSPORT State",
        0x03: "BUSY State"
    },

    //var NETWORK = {
    //    public : 0x00
    //};

    // ANTFS TS p. 50 - commands are send either as acknowledged data or bursts depending on payload size
    // COMMAND format : p. 49 ANTFS Command/Response ID = 0x44, Command, Parameters ...
    COMMAND_ID: {
        COMMAND_RESPONSE_ID: 0x44,
        LINK: 0x02,
        DISCONNECT: 0x03,
        AUTHENTICATE: 0x04,
        PING: 0x05,
        DOWNLOAD: 0x09,
        UPLOAD: 0x0A,
        ERASE: 0x0B,
        UPLOAD_DATA: 0x0C
    },

    // ANTFS TS p. 51
    RESPONSE_ID: {
        authenticate: 0x84,
        download: 0x89,
        upload: 0x8A,
        erase: 0x8b,
        upload_data: 0x8c
    },

    BEACON_CHANNEL_PERIOD: {
        HzHalf: 0x00, // 0.5 Hz
        Hz1: 0x01,
        Hz2: 0x02,
        Hz4: 0x03,
        Hz8: 0x04 , // 8 Hz
        0x00: "0.5 Hz (65535)", // 000
        0x01: "1 Hz (32768)",   // 001
        0x02: "2 Hz (16384)",   // 010
        0x03: "4 Hz (8192)",    // 011
        0x04: "8 Hz (4096)",    // 100
        0x07: "Match established channel period (broadcast ANT-FS only)" // 111
    },

    AUTHENTICATION_TYPE : {
        PASS_THROUGH: 0x00,
        PAIRING_ONLY: 0x02,
        PASSKEY_AND_PAIRING_ONLY : 0x03,
        0x00: "Pass-through supported (pairing & passkey optional)",
        0x02: "Pairing only",
        0x03: "Passkey and Pairing only"
    },

    DISCONNECT_COMMAND : {
        RETURN_TO_LINK_LAYER : 0x00,
        RETURN_TO_BROADCAST_MODE : 0x01
        // 2-127 reserved
        // 128 - 255 device specific disconnect
    },

    AUTHENTICATE_COMMAND : {
        PROCEED_TO_TRANSPORT : 0x00, // Pass-through
        REQUEST_CLIENT_DEVICE_SERIAL_NUMBER : 0x01,
        REQUEST_PAIRING : 0x02,
        REQUEST_PASSKEY_EXCHANGE : 0x03
    },
    
    // host serial number is available on antInstance.serialNumber if getDeviceSerialNumber has been executed
    ANTFSCOMMAND_Link: function (channelFreq, channelPeriod, hostSerialNumber) {
        var payload = new Buffer(8);

        payload[0] = DeviceProfile_ANTFS.prototype.COMMAND_ID.COMMAND_RESPONSE_ID; // 0x44;
        payload[1] = DeviceProfile_ANTFS.prototype.COMMAND_ID.LINK;
        payload[2] = channelFreq;    // Offset from 2400 Mhz
        payload[3] = channelPeriod; // 0x04 = 8 Hz
        payload.writeUInt32LE(hostSerialNumber, 4);

        return payload;
    },

    // p. 52 ANT-FS technical spec.
    ANTFSCOMMAND_Disconnect : function (commandType, timeDuration, applicationSpecificDuration)
    {
        // timeDuration - 0x00 - Disabled/Invalid
        // application specific duration - 0x00 - Disabled/Invalid
        var payload = new Buffer(4);

        payload[0] = DeviceProfile_ANTFS.prototype.COMMAND_ID.COMMAND_RESPONSE_ID; // 0x44;
        payload[1] = DeviceProfile_ANTFS.prototype.COMMAND_ID.DISCONNECT;
        payload[2] = timeDuration;
        payload[3] = applicationSpecificDuration;

        return payload;
    },

    ANTFSCOMMAND_Authentication : function (commandType, authStringLength, hostSerialNumber)
    {
        var payload = new Buffer(8);

        payload[0] = DeviceProfile_ANTFS.prototype.COMMAND_ID.COMMAND_RESPONSE_ID; // 0x44;
        payload[1] = DeviceProfile_ANTFS.prototype.COMMAND_ID.AUTHENTICATE;
        payload[2] = commandType;
        payload[3] = authStringLength; // "Set to 0 if no authentication is to be supplied", "string is bursts to the client immediately following this command"
        payload.writeUInt32LE(hostSerialNumber, 4);

        return payload;
    },

    getSlaveChannelConfiguration: function (networkNr, channelNr, deviceNr, deviceType, transmissionType, searchTimeout) {
        // Setup channel parameters for ANT-FS
        this.channel = new Channel(channelNr, Channel.prototype.CHANNEL_TYPE.receive_channel, networkNr, Network.prototype.NETWORK_KEY.ANTFS);

        this.channel.setChannelId(deviceNr, deviceType, transmissionType, false);
        this.channel.setChannelPeriod(DeviceProfile_ANTFS.prototype.CHANNEL_PERIOD);
        this.channel.setChannelSearchTimeout(ANT.prototype.INFINITE_SEARCH);
        this.channel.setChannelFrequency(ANT.prototype.ANTFS_FREQUENCY);
        this.channel.setChannelSearchWaveform(DeviceProfile_ANTFS.prototype.SEARCH_WAVEFORM);

        this.channel.broadCastDataParser = this.broadCastDataParser || DeviceProfile.prototype.broadCastDataParser;
        this.channel.channelResponseEvent = this.channelResponseEvent || DeviceProfile.prototype.channelResponseEvent;

        this.channel.nodeInstance = this.nodeInstance; // Attach channel to nodeInstance
        this.channel.deviceProfile = this; // Attach channel to device profile

        return this.channel;
    },

    channelResponseEvent : function (data)
    {
        console.log(Date.now() + " Got channelResponseEvent on ANT-FS channel ", data);

        // This === channelConfiguration
        //console.log("THIS", this);

        switch (this.deviceProfile.state) {
            // LINK layer
            case DeviceProfile_ANTFS.prototype.STATE.LINK_LAYER:
                console.log("IN LINK LAYER");

                if (this.nodeInstance.ANT.isEvent(ANT.prototype.RESPONSE_EVENT_CODES.EVENT_TRANSFER_TX_COMPLETED, data)) {
                    this.deviceProfile.state = DeviceProfile_ANTFS.prototype.STATE.AUTHENTICATION_LAYER; // Expect AUTHENTICATION BEACON from client
                    delete this.deviceProfile.sendingLINK;
                    console.log("YIPPI, got event transfer completed!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
                } else
                    delete this.deviceProfile.sendingLINK; // Resend link command

                //if (this.nodeInstance.ANT.isEvent(ANT.prototype.RESPONSE_EVENT_CODES.EVENT_TRANSFER_TX_FAILED, data))
                //    console.log("YIPPI, got event transfer FAILED!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

                break;

            default:
                console.log("LAYER for state %d not implemented", this.deviceProfile.state);
                break;
        }


    },
    
    // It seems like the Garmin 910XT ANTFS client open the channel for about 1.75 sec. each 20 seconds. At 8Hz message rate we can expected max 16 beacon messages. -> maybe to conserve power
    // The generates a series of EVENT_RX_FAIL which eventually leads to EVENT_RX_FAIL_GO_TO_SEARCH -> host expected messages to arrive, but
    // client (910XT) has closed the channel, fallback for host is to return to search mode again
    // I suppose that when authentication succeeds and we enter transport layer state, the client will step up its game and provide continous stream of data
    // ANT-FS Technical specification p. 40 s. 9.1 Beacon "Client beacon rates will be application dependent. A trade off is made between power and latecy"
    parseClientBeacon: function (data) {
        var
            beaconInfo = {
                    status1: data[5],
                    status2: data[6],
                    authenticationType: data[7],
            };

        beaconInfo.dataAvailable = beaconInfo.status1 & 0x20 ? true : false // Bit 5
        beaconInfo.uploadEnabled = beaconInfo.status1 & 0x10 ? true : false, // Bit 4
        beaconInfo.pairingEnabled = beaconInfo.status1 & 0x8 ? true : false, // Bit 3
        beaconInfo.beaconChannelPeriod = beaconInfo.status1 & 0x7,// Bit 2-0

        beaconInfo.clientDeviceState = beaconInfo.status2 & 0xFF;

        if (beaconInfo.clientDeviceState === DeviceProfile_ANTFS.prototype.STATE.AUTHENTICATION_LAYER || beaconInfo.clientDeviceState === DeviceProfile_ANTFS.prototype.STATE.TRANSPORT_LAYER)
            beaconInfo.hostSerialNumber = data.readUInt32LE(8);
        else if (beaconInfo.clientDeviceState === DeviceProfile_ANTFS.prototype.STATE.LINK_LAYER) {
            beaconInfo.deviceType = data.readUInt16LE(8);
            beaconInfo.manufacturerID = data.readUInt16LE(10);
        }

        function parseStatus1() {
           
            status1Str = "ANT-FS Beacon ";

            if (beaconInfo.dataAvailable)
                status1Str += "+Data ";
            else
                status1Str += "-Data. ";

            if (beaconInfo.uploadEnabled)
                status1Str += "+Upload ";
            else
                status1Str += "-Upload ";

            if (beaconInfo.pairingEnabled)
                status1Str += "+Pairing ";
            else
                status1Str += "-Pairing ";

            status1Str +=  DeviceProfile_ANTFS.prototype.BEACON_CHANNEL_PERIOD[beaconInfo.beaconChannelPeriod];

            return status1Str;

        }

        beaconInfo.toString = function () {

            if (beaconInfo.clientDeviceState === DeviceProfile_ANTFS.prototype.STATE.LINK_LAYER)
                return parseStatus1() + " " + DeviceProfile_ANTFS.prototype.STATE[beaconInfo.status2 & 0x0F] + " Device type " + beaconInfo.deviceType + " Manuf. ID " + beaconInfo.manufacturerID + " " + DeviceProfile_ANTFS.prototype.AUTHENTICATION_TYPE[beaconInfo.authenticationType];
            else
                return parseStatus1() + " " + DeviceProfile_ANTFS.prototype.STATE[beaconInfo.status2 & 0x0F] + " Host SN. " + beaconInfo.hostSerialNumber + " " + DeviceProfile_ANTFS.prototype.AUTHENTICATION_TYPE[beaconInfo.authenticationType];
        }

        return beaconInfo;
    },

    sendLinkCommand : function ()
    {
        //console.log("LINK", this); this = channelConfiguration
        var channelNr = this.number, self = this;
        var linkMsg = this.deviceProfile.ANTFSCOMMAND_Link(ANT.prototype.ANTFS_FREQUENCY, DeviceProfile_ANTFS.prototype.BEACON_CHANNEL_PERIOD.Hz8, this.nodeInstance.ANT.serialNumber);
        this.nodeInstance.ANT.sendAcknowledgedData(channelNr, linkMsg,
            function error(error) {
                console.log(Date.now() + " Could not send ANT-FS link command ", error);
                delete self.deviceProfile.sendingLINK;
            },
            function success() {
                console.log(Date.now() + " ANT-FS link command sent.");
               
            });
    },

    broadCastDataParser: function (data) {
        var beaconID = data[4], channelNr = data[3],
            beacon;
        // Check for valid beacon ID 0x43 , p. 45 ANT-FS Technical Spec.

        if (beaconID !== DeviceProfile_ANTFS.prototype.BEACON_ID)
            console.log("Expected beacon ID ", DeviceProfile_ANTFS.prototype.BEACON_ID, ", but got ", beaconID, " not a valid beacon broadcast. ", data);
        else {

            // If we not have updated channel id, then get it


            beacon = this.nodeInstance.deviceProfile_ANTFS.parseClientBeacon(data);
            console.log(Date.now() + " " + beacon.toString());

            if (beacon.clientDeviceState === DeviceProfile_ANTFS.prototype.STATE.LINK_LAYER) {
                this.deviceProfile.state = DeviceProfile_ANTFS.prototype.STATE.LINK_LAYER; // Follow same state in host as the device/client;

                switch (beacon.authenticationType) {
                    case DeviceProfile_ANTFS.prototype.AUTHENTICATION_TYPE.PASSKEY_AND_PAIRING_ONLY:
                        //console.log("Proceeding to authentication....");
                        //console.trace();
                        // Send LINK command
                        //console.log("LINK MSG. PAYLOAD", linkMsg);

                        // Do not enter this region more than once
                        if (typeof this.deviceProfile.sendingLINK === "undefined") {
                            this.deviceProfile.sendingLINK = true;
                            this.nodeInstance.deviceProfile_ANTFS.sendLinkCommand.call(this);
                        }

                        break;

                    default:
                        console.error("Authentication type not implemented ",DeviceProfile_ANTFS.prototype.AUTHENTICATION_TYPE[beacon.authentication],"("+beacon.authentication+")");
                        break;
                }
            } else if (beacon.clientDeviceState === DeviceProfile_ANTFS.prototype.STATE.AUTHENTICATION_LAYER) {
                // One exception is EVENT_TRANSFER_TX_FAILED of link command (but device got the command and still sends AUTHENTICATION BEACON)  
                this.deviceProfile.state = DeviceProfile_ANTFS.prototype.STATE.LINK_LAYER; // Follow same state in host as the device/client;

                // Is authentication beacon for us?

                if (beacon.hostSerialNumber !== this.nodeInstance.ANT.serialNumber)
                    console.warn("Authentication beacon for ", beacon.hostSerialNumber, " device serial number is ", this.nodeInstance.ANT.serialNumber);
                else
                    console.log("CLIENT AUTHENTICATION STATE NOT IMPLEMENTED");
            }
               
        }
    }
};

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
        console.log(Date.now()+" SPDCAD broad cast data ",data);
    }
};


function Node() {
     var self = this;
     self.heartBeat = 0;
    self.heartBeatIntervalID =  setInterval(self.beat, 60000*60*24); // 1 "beat" each day 
   
    // var idVendor = 4047, idProduct = 4104; // Garmin USB2 Wireless ANT+
    this.ANT = new ANT(4047, 4104);

    this.deviceProfile_HRM = new DeviceProfile_HRM(this);
    this.deviceProfile_SDM = new DeviceProfile_SDM(this);
    this.deviceProfile_ANTFS = new DeviceProfile_ANTFS(this);
    this.deviceProfile_SPDCAD = new DeviceProfile_SPDCAD(this);

    function success() {
       // console.log(self.ANT);
        
        //self.channels[1] = self.getDeviceProfile_HRM(1, 0, 0, 0, INFINITE_SEARCH, true);
        //console.log(JSON.stringify(self.getDeviceProfile_HRM(1,0,0,0,INFINITE_SEARCH,true)));
        self.start();
    }

    function error() {
        self.stop();
    }
 
    self.ANT.init(error, success);
}

Node.prototype = {

    WEBSOCKET_HOST : 'localhost',
    WEBSOCKET_PORT : 8093,

    broadCast :  // Broadcast data to all clients
     function (data) {
         var self = this;

         if (typeof self.wss === "undefined") {
             console.warn("Cannot broadcast data, no websocket server available");
             return;
         }
         
         var len = self.wss.clients.length;
         //console.log("Length of clients", len);
         for (var clientNr = 0; clientNr < len; clientNr++) {
             if (typeof self.wss.clients !== "undefined" && self.wss.clients[clientNr] !== "undefined") // Just to make sure we have clientTracking and client is present
             {
                 //console.log("Sending data to client nr. ", clientNr, "data:",data);
                 self.wss.clients[clientNr].send(data);
             } else
                 console.warn("Found no clients to send data to, is websocket server operative?");
         }
     },

   stop: function () {
       var self = this;
        clearInterval(self.heartBeatIntervalID);
    },

   beat : function ()  // When we have nothing more important to do ...
   {
       var self = this;
      // console.log("HB");
        self.heartBeat++;
   },

   

   start: function () {
       var self = this;
       
       // Handle gracefull termination
       // http://thomashunter.name/blog/gracefully-kill-node-js-app-from-ctrl-c/

       process.on('SIGINT', function () {
           // console.log("\nSignal interrut event SIGINT (Ctrl+C)");
           //self.ANT.inTransfer.cancel(); // Gracefull termination of possible pending transfer on in endpoint
           if (typeof self.wss !== "undefined") {
               console.log("Closing websocket server, terminating connections to clients");
               self.wss.close();
           }
           self.ANT.exit();
       });

       // Channel configurations indexed by channel nr.
          
       self.ANT.channelConfiguration[1] = self.deviceProfile_ANTFS.getSlaveChannelConfiguration(Network.prototype.ANT_FS, 1, 0, 0, 0);
       self.ANT.channelConfiguration[0] = self.deviceProfile_HRM.getSlaveChannelConfiguration(Network.prototype.ANT, 0, 0, 0, ANT.prototype.INFINITE_SEARCH);
       self.ANT.channelConfiguration[2] = self.deviceProfile_SDM.getSlaveChannelConfiguration(Network.prototype.ANT, 2, 0, 0, ANT.prototype.INFINITE_SEARCH);
       self.ANT.channelConfiguration[3] = self.deviceProfile_SPDCAD.getSlaveChannelConfiguration(Network.prototype.ANT, 3, 0, 0, ANT.prototype.INFINITE_SEARCH);

       //console.log(self.ANT.channelConfiguration[0]);

       //self.ANT.open(0, function () {
       //    console.log("Open error");
       //}, function () {
       //    console.log("Open OK");
       //});

       // Lesson : ANT-FS and HRM on different network due to different keys
       // Seems like : Cannot simultaneously listen to broadcasts from ANT-FS =  2450 MHz and HRM/Bike spd/Stride sensor = 2457 Mhz, but with different msg. periode

       self.ANT.configure(0, function () { console.log("Could not configure device profile HRM"); }, function () {
           console.log("Configuration of device profile HRM channel OK");
           self.ANT.configure(1, function () { console.log("Could not configure device profile ANT-FS"); }, function () {
               console.log("Configuration of device profile ANT-FS OK");
               self.ANT.configure(3, function () { console.log("Could not configure device profile SPDCAD"); }, function () {
                   //console.log("Configuration of device profile SDM OK");
                   self.ANT.configure(2, function () { console.log("Could not configure device profile SDM"); }, function () {
                       //console.log("Configuration of device profile SDM OK");
                       //self.ANT.open(0, function () { console.log("Could not open channel for HRM"); }, function () {
                       //    console.log("Open channel for HRM");
                       //    self.ANT.open(2, function () { console.log("Could not open channel for SDM"); }, function () {
                       //        console.log("Open channel for SDM");
                       //console.log(self.ANT.channelConfiguration);
                               self.ANT.open(1, function () { console.log("Could not open channel for ANT-FS"); }, function () {
                                   console.log("Open channel for ANT-FS");
                                   self.ANT.listen.call(self.ANT); 
                               });
                       //    });
                       //})
                   });
               });
           });
       });
   
           // setTimeout(function () {
           //     self.ANTEngine.send(ANT_ResetSystem(false), DEFAULT_RETRY, 50,
           //         function (data) { return isStartupNotification(data); },
           //         function () { console.log("Could not reset device, try to reinsert USB stick to clean up buffers and drivers."); exitApplication(); },
           //         function (data) {
           //         //parse_response(data);
           //         console.log("Reset system OK");
           //         self.initLinkLayer();
           //        
           //     });
           // }, 500); // Allow 500ms after reset before proceeding
           

       // Start websocket server

       var WebSocketServer = require('ws').Server;

       // Client tracking keeps track of websocket server clients in "clients" property -> removed on 'close'
       self.wss = new WebSocketServer({ host: Node.prototype.WEBSOCKET_HOST, port: Node.prototype.WEBSOCKET_PORT, clientTracking: true });

       self.wss.on('listening', function () {
           console.log(Date.now() + " WebsocketServer: listening on " + Node.prototype.WEBSOCKET_HOST + ":" + Node.prototype.WEBSOCKET_PORT);
       });

       self.wss.on('connection', function (ws) {
           console.log(Date.now() + " WebsocketServer: New client connected - will receive broadcast data");
           // console.log(ws);
           //self.websockets.push(ws); // Keeps track of all incoming websocket clients

           ws.on('message', function (message) {
               console.log(Date.now() + ' Received: %s', message);
               //    ws.send('something');
           });
       });

       self.wss.on('error', function (error) {
           console.log(Date.now() + "WebsocketServer: Error ", error);
       });

       
    },

    // Set host in ANTFS searchmode for LINK beacon 
   initLinkLayer: function () {
       var self = this;

       self.channels[0].configure(self.ANTEngine, function () {
           exitApplication();
       },
        function () {
            self.channels[0].open(self.ANTEngine, function () { exitApplication(); },
                function () {
                    console.log("Channel open");
                    self.findLinkBeacon(30000, 6, function () {
                        console.log("Could not find LINK beacon. Terminating.");
                        //process.kill(process.pid, 'SIGINT');
                        exitApplication();

                    });
                });
        });


       
            // Observation : Executing transmission direct to USB ANT device takes about 5-7 ms. -> timeout on 15 ms. seems like ok.
            function exit(msg) {
                console.log(msg);
                exitApplication();
            }

           
   },

   findLinkBeacon : function(timeout, maxRetries, errorCallback) {
      
        var msgId, beaconId;
        var linkBeaconFound = false;
        var maxReceiveErrorRetries = maxRetries, retryNr = 0;

        ant.timeout = timeout;

        // Observation -- too small buffer gives "LIBUSB_TRANSFER_STALL"
   
        function retry() {
            if (retryNr > maxReceiveErrorRetries)  // Stop recursion...
                errorCallback();
            else
                inEP.transfer(ANT.prototype.DEFAULT_ENDPOINT_PACKET_SIZE, function (error, data) {
                    if (error) {
                        console.log(Date.now() + "Receive: " + error + ", retrying search for LINK beacon...");
                        retryNr++; // Only incremented on error
                        retry(); // Recursion
                    }
                    else {
                        // console.log(data);
                        msgId = data[2];

                        if (data.length > 5)
                            beaconId = data[4];

                        if (msgId === ANT_MESSAGE.broadcast_data.id && beaconId === DeviceProfile_ANTFS.prototype.BEACON_ID) { // ANTFS Beacon

                            console.log(data);

                            ANTFS_HOST.beaconInfo = parseClientBeacon(data);  // Update beacon info.
                            console.log(Date.now() + " " + ANTFS_HOST.beaconInfo.toString(), linkBeaconFound);
                            // getUpdatedChannelID();
                            //// ANT_Request(true, ANT_MESSAGE.set_channel_id.id);  // Get updated channel ID parameters
                            if (ANTFS_HOST.beaconInfo.clientDeviceState === ANTFS_STATE.LINK_LAYER && !linkBeaconFound) {
                                ANTFS_HOST.state = ANTFS_STATE.LINK_LAYER;
                                linkBeaconFound = true;
                                console.log("LINK beacon found");

                                // 9.2 p. 40 "ANT-FS connections should be established on a different RF channel frequency than the initial Link State, or pre-defined RF channel freq. such as the ANT+ freq. (2457Mhz)

                                // Send LINK command request to device (its sent immedialy upon receiving next broadcast/link beacon from device)
                                send(ANT_SendAcknowledgedData(false, 0, ANTFSCOMMAND_Link(Host.prototype.DEFAULT_CHANNEL_FREQUENCY, BEACON_CHANNEL_PERIOD.Hz8, ANTFS_HOST.serialNumber)), DEFAULT_RETRY, 30000,
                                                                 undefined,
                                                                   function () { console.log("Failed to send LINK command to device."); errorCallback(); },
                                                                    function (data) {
                                                                        console.log("Sent link command");
                                                                        //console.log(data); parse_response(data);
                                                                        //retry();
                                                                        //send(ANT_SetChannelRFFreq(false, 0, ALTERNATIVE_CHANNEL_FREQUENCY),
                                                                        //    DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
                                                                        //    function (data) { return isResponseNoError(data, ANT_MESSAGE.set_channel_RFFreq.id); },
                                                                        //    function () { console.log("Failed to change RF frequency to " + ALTERNATIVE_CHANNEL_FREQUENCY + " MHz") },
                                                                        //    function (data) {
                                                                        //        console.log("Set channel RF frequency OK - now on " + ALTERNATIVE_CHANNEL_FREQUENCY + " MHz");
                                                                        //    });
                                                                    }, true);




                                //parse_response(data);
                                //findLinkBeacon();
                                //if (!validationCallback(data)) {
                                //    // console.log("Expected startup notification after reset command, but got " + RESPONSE_EVENT_CODES[data[2]] + ", retrying...");
                                //    retry(--maxRetries);
                                //} else
                                //    successCallback(data);

                            } else if (ANTFS_HOST.beaconInfo.clientDeviceState === ANTFS_STATE.AUTHENTICATION_LAYER && linkBeaconFound && ANTFS_HOST.beaconInfo.raw.hostSerialNumber === ANTFS_HOST.serialNumber) {
                                ANTFS_HOST.state = ANTFS_STATE.AUTHENTICATION_LAYER;
                                linkBeaconFound = false;
                                // Observation - FR 910XT will send AUTH beacon for 3 seconds, then power save (gives EVENT_RX_FAIL/GO_TO_SEARCH), and stransferring LINK beacon again
                                console.log(Date.now() + " Got AUTHENTICATION beacon for host serial number: " + ANTFS_HOST.serialNumber,linkBeaconFound);

                            } else if (ANTFS_HOST.beaconInfo.clientDeviceState === ANTFS_STATE.BUSY) {
                                console.log(Date.now() + " Device is busy (processing previous command)");

                            }
                            else {
                                parse_response(data);
                                // Just skip other messages (EVENT_RX_FAIL/EVENT_RX_GO_TO_SEARCH -> probably due to power saving on device LINK beacon is sent in a small window)
                            }
                        }
                    }
                    retry();
                });
        }

        retry();
        
    }

};

function Network(nr, key) {
    this.number = nr;
    this.key = key;
}

Network.prototype = {
     NETWORK_KEY : {
        ANTFS: [0xa8, 0xa4, 0x23, 0xb9, 0xf5, 0x5e, 0x63, 0xc1], // For accessing Garmin ANT-FS
        ANT: [0xB9, 0xA5, 0x21, 0xFB, 0xBD, 0x72, 0xC3, 0x45] // ANT+ managed network key, i.e HRM device profile
     },
     ANT : 0,      // Separate networks due to different keys
     ANT_FS : 1,
}

function Channel(channelNr, channelType, networkNr) {
    //this.host = host;
    this.number = channelNr;
    this.channelType = channelType;
    this.network = new Network(networkNr);
    //this.ANTEngine = new ANT(host,this);
    //this.ANTEngine = engine;
}

function Channel(channelNr, channelType, networkNr, networkKey) {
    //this.host = host;
    this.number = channelNr;
    this.channelType = channelType;
    this.network = new Network(networkNr, networkKey);
    //this.ANTEngine = new ANT(host, this);
    
}

Channel.prototype = {

     CHANNEL_TYPE : {
         // Bidirectional
         0x00 : "Bidirectional Slave Channel",
         receive_channel: 0x00, // slave
         0x10 : "Bidirectional Master Channel",
        transmit_channel: 0x10, // master
         // Unidirectional
         0x50 : "Master Transmit Only Channel (legacy)",
         transmit_only_channel: 0x50,
         0x40 : "Slave Receive Only Channel (diagnostic)",
        receive_only_channel: 0x40,
         // Shared channels
        0x20 : "Shared bidirectional Slave channel",
        shared_bidirectional_receive_channel: 0x20,
         0x30 : "Shared bidirectional Master channel",
        shared_bidirectional_transmit_channel: 0x30
    },

     setChannelId: function (usDeviceNum, ucDeviceType, ucTransmissionType, pairing) {
         if (typeof usDeviceNum === "undefined" || typeof ucDeviceType === "undefined" || typeof ucTransmissionType === "undefined")
             console.error("Undefined parameters ", usDeviceNum, ucDeviceType, ucTransmissionType);

        this.deviceNumber = usDeviceNum; // 16-bit
        this.deviceType = ucDeviceType; // i.e HRM = 0x78 = 120 dec. 8-bit ANTWare 0 - 127, 0 = wildcard, 7-bit pairing
        if (pairing)
            this.deviceType = ucDeviceType | 0x80; // Set bit 7 high;
        this.transmissionType = ucTransmissionType;
    },

    setChannelPeriod: function (usMessagePeriod) {
        var rate;
        this.period = usMessagePeriod;

        switch (usMessagePeriod) {
            case 65535: rate = "0.5 Hz (65535)"; break;
            case 32768: rate = "1 Hz (32768)"; break;
            case 16384: rate = "2 Hz (16384)"; break;
            case 8192: rate = "4 Hz (8192)"; break;
            case 8070: rate = (32768 / 8070).toFixed(2) + " Hz (8070)"; break; // HRM
            case 4096: rate = "8 Hz (4096)"; break;
            default: rate =  usMessagePeriod + " "+(32768 / usMessagePeriod).toFixed(2)+" Hz"; break;
        }

        this.periodFriendly = rate;
    },

    setChannelSearchTimeout: function (ucSearchTimeout) {
        var friendlyFormat;

        this.searchTimeout = ucSearchTimeout;

        switch (ucSearchTimeout)
        {
            case 0 :
                friendlyFormat =  "Setting search timeout for channel "+this.number+" to "+ucSearchTimeout+ " = Disable high priority searcg mode";
                break;
            case 255 :
                friendlyFormat = "Setting search timeout for channel "+this.number+" to "+ucSearchTimeout+ " = Infinite search"; 
                break;
            default:
                friendlyFormat = "Setting search timeout for channel "+this.number+" to "+ucSearchTimeout+ " = "+ucSearchTimeout*2.5+ "sec.";
                break;
        }

        this.searchTimeoutFriendly = friendlyFormat;
    },

    setChannelFrequency: function (ucRFFreq) {
        var  freq = 2400 + ucRFFreq, friendlyFormat;

        friendlyFormat = "Setting RF frequency to " + freq + " MHz";

        this.RFfrequency = ucRFFreq;
        this.RFfrequencyFriendly = friendlyFormat;
    },

    setChannelSearchWaveform: function (waveform) {
        this.searchWaveform = waveform;
    },

};

// Low level API/interface to ANT USB stick
    function ANT(idVendor,idProduct) {
       // this.channel = channel;
        // this.host = host;
        this.idVendor = idVendor;
        this.idProduct = idProduct;
        
    }

    ANT.prototype = {

        DEFAULT_ENDPOINT_PACKET_SIZE : 64,  // Based on info in nRF24AP2 data sheet

         SYNC : 0xA4, // Every raw ANT message starts with SYNC

        ANT_DEVICE_TIMEOUT: 3 * 7, // Direct USB ANT communication  (normal 5-7 ms. processing time on device)
        ANT_DEFAULT_RETRY : 2,
        INFINITE_SEARCH: 0xFF,

        ANT_FREQUENCY: 57,
        ANTFS_FREQUENCY : 50,

        // ANT message ID - from sec 9.3 ANT Message Summary ANT Message Protocol And Usave Rev 50
         ANT_MESSAGE : {
    
            // Control messages

            0x4a : "Reset system",
            reset_system: { id: 0x4a, friendly: "Reset system" },

            0x4b : "Open channel",
            open_channel: { id: 0x4b, friendly: "Open channel" },

            0x4c : "Close channel",
            close_channel: { id: 0x4c, friendly: "Close channel" },

            0x5b : "Open RX scan mode",
            open_rx_scan_mode: { id: 0x5b, friendly: "Open RX scan mode" },

            0xc5 : "Sleep message",
            sleep_message: { id: 0xc5, friendly: "Sleep message" },

            // Notification messages
            0x6f : "Start up",
            startup: { id: 0x6f, friendly: "Start-up" },
            0xae : "Serial error",
            serial_error: { id: 0xae, friendly: "Serial error" },

            // Request/response

            0x4d: "Request",
            request: { id: 0x4d, friendly: "Request" },

            0x40 : "Channel response/event",
            channel_response: { id: 0x40, friendly: "Channel Response/Event" },

            0x52: "Channel Status",
            channel_status: { id: 0x52, friendly: "Channel Status" },

            0x3E: "ANT version",
            ANT_version: { id: 0x3E, friendly: "ANT Version" },

            0x54 : "Capabilities",
            capabilities: { id: 0x54, friendly: "Capabilities" },

            0x61 : "Device serial number",
            device_serial_number: { id: 0x61, friendly: "Device Serial Number" },

            // Config messages
            // All conf. commands receive a response
            0x41: "Unassign channel",
            unassign_channel: { id: 0x41, friendly: "Unassign channel" },

            0x42: "Assign channel",
            assign_channel: { id: 0x42, friendly: "Assign channel" }, // Also sets additional parameters to defaults
  
            0x46: "Set network key",
            set_network_key: { id: 0x46, friendly: "Set network key" },

            0x47: "Transmit power",
            transmit_power: { id: 0x47, friendly: "Transmit power" },

            0x51: "Channel ID",
            set_channel_id: { id: 0x51, friendly: "Set channel id" },

            0x43: "Channel period",
            set_channel_messaging_period: { id: 0x43, friendly: "Set Channel Messaging Period" },

            0x44: "Search timeout",
            set_channel_search_timeout: { id: 0x44, friendly: "Set Channel Search Timeout" },

            0x45: "Channel RF frequency",
            set_channel_RFFreq: { id: 0x45, friendly: "Set Channel RF Frequency" },

            0x49 : "Search waveform",
            set_search_waveform: { id: 0x49, friendly: "Set search waveform" },

            // Data message

            0x4E: "Broadcast Data",
            broadcast_data: { id: 0x4e, friendly: "Broadcast data" },

            0x4F: "Acknowledged Data",
            acknowledged_data: { id: 0x4f, friendly: "Acknowledged data" },

            0x50: "Burst Transfer Data",
            burst_transfer_data: { id: 0x50, friendly: "Burst transfer data" },

            0x72: "Advanced Burst Transfer Data",
            advanced_burst_transfer_data: { id: 0x72, friendly: "Advanced burst transfer data" },

        },

         RESPONSE_EVENT_CODES: {

            RESPONSE_NO_ERROR : 0x00,
            0x00: { friendly: "RESPONSE_NO_ERROR" },

            EVENT_RX_TIMEOUT : 0x01,
            0x01: { friendly: "EVENT_RX_TIMEOUT" },

            EVENT_RX_FAIL : 0x02,
            0x02: { friendly: "EVENT_RX_FAIL" },

            EVENT_TX : 0x03,
            0x03: { friendly: "EVENT_TX" },

            EVENT_TRANSFER_RX_FAILED : 0x04,
            0x04: { friendly: "EVENT_TRANSFER_RX_FAILED" },

            EVENT_TRANSFER_TX_COMPLETED : 0x05,
            0x05: { friendly: "EVENT_TRANSFER_TX_COMPLETED" },

            EVENT_TRANSFER_TX_FAILED : 0x06,
            0x06: { friendly: "EVENT_TRANSFER_TX_FAILED" },

            EVENT_CHANNEL_CLOSED : 0x07,
            0x07: { friendly: "EVENT_CHANNEL_CLOSED" },

            EVENT_RX_FAIL_GO_TO_SEARCH : 0x08,
            0x08: { friendly: "EVENT_RX_FAIL_GO_TO_SEARCH" },

            EVENT_CHANNEL_COLLISION : 0x09,
            0x09: { friendly: "EVENT_CHANNEL_COLLISION" },

            EVENT_TRANSFER_TX_START :  0x0A,
            0x0A: { friendly: "EVENT_TRANSFER_TX_START" },

            EVENT_TRANSFER_NEXT_DATA_BLOCK : 0x11,
            0x11: { friendly: "EVENT_TRANSFER_NEXT_DATA_BLOCK" },

            CHANNEL_IN_WRONG_STATE : 0x15,
            0x15: { friendly: "CHANNEL_IN_WRONG_STATE" },

            CHANNEL_NOT_OPENED : 0x16,
            0x16: { friendly: "CHANNEL_NOT_OPENED" },

            CHANNEL_ID_NOT_SET : 0x18,
            0x18: { friendly: "CHANNEL_ID_NOT_SET" },

            CLOSE_ALL_CHANNELS : 0x19,
            0x19: { friendly: "CLOSE_ALL_CHANNELS" },

            TRANSFER_IN_PROGRESS: 0x1F,
            0x1F: { friendly: "TRANSFER_IN_PROGRESS" },

            TRANSFER_SEQUENCE_NUMBER_ERROR : 0x20,
            0x20: { friendly: "TRANSFER_SEQUENCE_NUMBER_ERROR" },

            TRANSFER_IN_ERROR : 0x21,
            0x21: { friendly: "TRANSFER_IN_ERROR" },

            MESSAGE_SIZE_EXCEEDS_LIMIT : 0x27,
            0x27: { friendly: "MESSAGE_SIZE_EXCEEDS_LIMIT" },

            INVALID_MESSAGE : 0x28,
            0x28: { friendly: "INVALID_MESSAGE" },

            INVALID_NETWORK_NUMBER : 0x29,
            0x29: { friendly: "INVALID_NETWORK_NUMBER" },

            INVALID_LIST_ID : 0x30,
            0x30: { friendly: "INVALID_LIST_ID" },

            INVALID_SCAN_TX_CHANNEL : 0x31,
            0x31: { friendly: "INVALID_SCAN_TX_CHANNEL" },

            INVALID_PARAMETER_PROVIDED : 0x33,
            0x33: { friendly: "INVALID_PARAMETER_PROVIDED" },

            EVENT_SERIAL_QUEUE_OVERFLOW : 0x34,
            0x34: { friendly: "EVENT_SERIAL_QUEUE_OVERFLOW" },

            EVENT_QUEUE_OVERFLOW : 0x35,
            0x35: { friendly: "EVENT_QUEUE_OVERFLOW" },

            NVM_FULL_ERROR : 0x40,
            0x40: { friendly: "NVM_FULL_ERROR" },

            NVM_WRITE_ERROR : 0x41,
            0x41: { friendly: "NVM_WRITE_ERROR" },

            USB_STRING_WRITE_FAIL : 0x70,
            0x70: { friendly: "USB_STRING_WRITE_FAIL" },

            MESG_SERIAL_ERROR_ID : 0xAE,
            0xAE: { friendly: "MESG_SERIAL_ERROR_ID" },

            ENCRYPT_NEGOTIATION_SUCCESS : 0x38,
            0x38: { friendly: "ENCRYPT_NEGOTIATION_SUCCESS" },

            ENCRYPT_NEGOTIATION_FAIL : 0x39,
            0x39: { friendly: "ENCRYPT_NEGOTIATION_FAIL" },
         },

        // From spec. p. 17 - "an 8-bit field used to define certain transmission characteristics of a device" - shared address, global data pages.
        // For ANT+/ANTFS :
       
         parseTransmissionType : function (transmissionType)
         {
             var msg = "";
             
             // Bit 0-1
             switch (transmissionType & 0x03)
             {
                 case 0x00 : msg += "Reserved"; break;
                 case 0x01 : msg += "Independed Channel"; break;
                 case 0x02 : msg += "Shared Channel using 1 byte address (if supported)"; break;
                 case 0x03 : msg += "Shared Channel using 2 byte address"; break;
                 default : msg += "?"; break;
             }

             // Bit 2
             switch ((transmissionType & 0x07) >> 2)
             {
                 case 0 : msg += " | Global data pages not used"; break;
                 case 1 : msg += " | Global data pages used"; break;
                 default : msg += " | ?"; break;
             }

             msg += " | 4-bit extension of device number to 20 bit: "+((transmissionType & 0xF0) >> 4);

             return msg;
         },

         parseChannelID: function (data) {


             var channelID =
              {
                  channelNumber: data[3],
                  deviceNumber: data.readUInt16LE(4),
                  deviceTypeID: data[6],
                  transmissionType: data[7],
              },
                 self = this;

             channelID.toString = function () {
                 return "Channel nr. " + channelID.channelNumber + " device nr. " + channelID.deviceNumber + " type " + channelID.deviceTypeID + " transmission type " + self.parseTransmissionType(channelID.transmissionType);
             }

             return channelID;
         },

         parseChannelStatus : function(data) {
   
             var channelStatus = {
                 channelNumber: data[3],
                 channelType: (data[4] & 0xF0) >> 4,  // Bit 4:7
                 networkNumber: (data[4] & 0x0C) >> 2, // Bit 2:3
                 channelState: data[4] & 0x03 // Bit 0:1
        
             };

             switch (channelStatus.channelState)
             {
                 case 0 : channelStatus.channelStateFriendly = "Unassigned"; break;
                 case 1 : channelStatus.channelStateFriendly = "Assigned"; break;
                 case 2 : channelStatus.channelStateFriendly = "Searching"; break;
                 case 3 : channelStatus.channelStateFriendly = "Tracking"; break;
             }

             channelStatus.toString = function () {
                 return "Channel nr. " + channelStatus.channelNumber + " type " + Channel.prototype.CHANNEL_TYPE[channelStatus.channelType]+" ("+channelStatus.channelType+" ) network nr. " + channelStatus.networkNumber + " " + channelStatus.channelStateFriendly;
             };

             return channelStatus;
         },

         parseNotificationStartup: function (log, data) {
             var msg;

             if (data[3] === 0)
                 msg = "POWER_ON_RESET"
             else if (data[3] === 1)
                 msg = "HARDWARE_RESET_LINE";
             else if (data[3] & (1 << 2))
                 msg = "WATCH_DOG_RESET";
             else if (data[3] & (1 << 5))
                 msg = "COMMAND_RESET";
             else if (data[3] & (1 << 6))
                 msg = "SYNCHRONOUS_RESET";
             else if (data[3] & (1 << 7))
                 msg = "SUSPEND_RESET";

             if (log)
                 console.log(msg);

             return msg;

         },

         parseNotificationSerialError: function (data) {
             var msg;

             if (data[3] === 0)
                 msg = "First byte is not SYNC = 0xA4";
             else if (data[3] === 2)
                 msg = "Checksum incorrect";
             else if (data[3] === 3)
                 msg = "Message too large";

             if (log)
                 console.log(msg);

             return msg;
         },

         parseChannelResponse: function (data) {
             var channel = data[3],
                 msgId = data[4],
                 msgCode = data[5],
                     msg;

             if (msgId === 1) // Set to 1 for RF event
                 msg = "EVENT on channel " + channel + " " + ANT.prototype.RESPONSE_EVENT_CODES[msgCode].friendly;
             else
                 msg = "RESPONSE on channel " + channel + " to msg. id " + msgId + "  " + ANT.prototype.ANT_MESSAGE[msgId] + " " + ANT.prototype.RESPONSE_EVENT_CODES[msgCode].friendly;

             //if (log)
             //    console.log(msg);

             return msg;
         },


        // Overview on p. 58 - ANT Message Protocol and Usage
         parse_response: function (data) {
             var antInstance = this;
             //console.log("parse_response", this);

             var msgID = data[2];
             var channelNr;

             var msgStr = "";

             switch (msgID) {
                
                     // Notifications

                 case ANT.prototype.ANT_MESSAGE.startup.id:
                     msgStr += ANT.prototype.ANT_MESSAGE.startup.friendly + " " +
                      antInstance.parseNotificationStartup(false, data);
                     break;

                 case ANT.prototype.ANT_MESSAGE.serial_error.id:
                     msgStr += ANT.prototype.ANT_MESSAGE.serial_error.friendly + " " +
                     antInstance.parseNotificationSerialError(false, data);
                     break;

                     // Channel event or responses

                 case ANT.prototype.ANT_MESSAGE.channel_response.id:
                     msgStr += ANT.prototype.ANT_MESSAGE.channel_response.friendly + " " + antInstance.parseChannelResponse(data);
                    
                     // Call channel event/response-handler for each channel
                     channelNr = data[3];
                     
                      antInstance.channelConfiguration[channelNr].channelResponseEvent(data);

                     break;

                     // Response messages to request 

                     // Channel specific 

                 case ANT.prototype.ANT_MESSAGE.channel_status.id:
                     msgStr += ANT.prototype.ANT_MESSAGE.channel_status.friendly + " " +
                     antInstance.parseChannelStatus(data).toString();
                     break;

                 case ANT.prototype.ANT_MESSAGE.set_channel_id.id:
                     var channelID = antInstance.parseChannelID(data);
                     // Update channel configuration
             //        var channelID =
             //{
             //    channelNumber: data[3],
             //    deviceNumber: data.readUInt16LE(4),
             //    deviceTypeID: data[6],
             //    transmissionType: data[7],
                     //};

                     antInstance.channelConfiguration[channelID.channelNumber].deviceNumber = channelID.deviceNumber;
                     antInstance.channelConfiguration[channelID.channelNumber].deviceType = channelID.deviceTypeID;
                     antInstance.channelConfiguration[channelID.channelNumber].transmissionType = channelID.transmissionType;

                     msgStr += ANT.prototype.ANT_MESSAGE.set_channel_id.friendly + " " + channelID.toString();
                     
                     
                     break;

                     // ANT device specific, i.e nRF24AP2

                 case ANT.prototype.ANT_MESSAGE.ANT_version.id:
                     antInstance.ANTVersion = data.toString('ascii', 3, 13);
                     msgStr += ANT.prototype.ANT_MESSAGE.ANT_version.friendly + " " + antInstance.ANTVersion;
                     break;

                 case ANT.prototype.ANT_MESSAGE.capabilities.id:

                     msgStr += ANT.prototype.ANT_MESSAGE.capabilities.friendly + " " + antInstance.parseCapabilities(data).toString();
                    
                     break;

                 case ANT.prototype.ANT_MESSAGE.device_serial_number.id:

                     msgStr += ANT.prototype.ANT_MESSAGE.device_serial_number.friendly + " " +
                     antInstance.parseDeviceSerialNumber(data);
                     break;

                     // Data

                 case ANT.prototype.ANT_MESSAGE.broadcast_data.id:
                     msgStr += ANT.prototype.ANT_MESSAGE.broadcast_data.friendly + " ";

                     channelNr = data[3];
                     msgStr += " on channel " + channelNr;

                     // Check for updated channel ID to the connected device

                     if (typeof antInstance.channelConfiguration[channelNr].hasUpdatedChannelID === "undefined") {
                         
                         antInstance.getUpdatedChannelID(channelNr,
                             function error()
                             {
                                 console.error("Failed not get updated channel ID");
                             },
                            function success(data)
                            {
                                antInstance.channelConfiguration[channelNr].hasUpdatedChannelID = true;
                            });
                         
                     }
                     // Call to broadcast handler for channel

                     antInstance.channelConfiguration[channelNr].broadCastDataParser(data);

                     //if (data[4] === ANTFS_BEACON_ID) { // LINK Beacon
                     //    ANTFS_HOST.beaconInfo = parseClientBeacon(data);  // Update beacon info.
                     //    msgStr += ANTFS_HOST.beaconInfo.toString();
                     //    // ANT_Request(true, ANT_MESSAGE.set_channel_id.id);  // Get updated channel ID parameters
                     //    if (ANTFS_HOST.beaconInfo.clientDeviceState === ANTFS_STATE.LINK_LAYER && !LINK_COMMAND_SENT) {
                     //        ANTFS_link(true, 0, DEFAULT_CHANNEL_FREQUENCY, BEACON_CHANNEL_PERIOD.Hz8, ANTFS_HOST.serialNumber);
                     //        LINK_COMMAND_SENT = true;
                     //    }
                     //}
                     break;


                 default:
                     msgStr += "* NO parser specified *";

                     break;
             }

             console.log(Date.now() + " Rx: ",data,msgStr);
             //for (var byteNr = 0; byteNr < data.length; byteNr++) {
             //    if (byteNr === 0 && data[byteNr] === SYNC)
             //        console.log("Buffer index " + byteNr + ", value: " + data[byteNr] + " = SYNC");
             //    else if (byteNr === 1)
             //        console.log("Buffer index " + byteNr + ", value: " + data[byteNr] + " = LENGTH");
             //    else if (byteNr === 2)
             //        console.log("Buffer index " + byteNr + ", value: " + data[byteNr] + " = ID");
             //    else if (byteNr === data.length - 1)
             //        console.log("Buffer index " + byteNr + ", value: " + data[byteNr] + " = CHECKSUM");
             //    else
             //        console.log("Buffer index " + byteNr + ", value: " + data[byteNr]);
             //}

         },

        // Continuously listen on incoming traffic and send it to the general parser for further processing
         listen: function () {
             
             var self = this, NO_TIMEOUT = 0;

             function retry() {

                 self.read(NO_TIMEOUT, function error(error) {

                     if (error.errno !== usb.LIBUSB_TRANSFER_CANCELLED) { // May be aborted by pressing Ctrl-C in Node.js
                         console.log(Date.now()+" Listen:", error);
                         process.nextTick(retry);
                     }

                 }, function success(data) {
                     self.parse_response.call(self, data);
                     process.nextTick(retry);
                 });
             }

             retry();

         },


        /*
This function create a raw message 
// Message format
// SYNC MSG_LENGTH MSG_ID MSG_CONTENT (byte  0 - N -1) Checksum
// SYNC = 10100100 = 0xA4 or 10100101 (MSB:LSB)
// CheckSUM = XOR of all bytes in message
Content = Buffer
// Sending of LSB first = little endian NB!
*/
       create_message: function (message, content) {
             var index;

             var headerBuffer = new Buffer(3), contentBuffer, messageBuffer, trailingZeroBuffer;

             var content_len;
             if (content)
                 content_len = content.length;
             else {
                 console.warn("Content length is 0");
                 content_len = 0;
             }

             //console.log("Message id. ", message.id, " Content is ", content);

             contentBuffer = new Buffer(content_len);
             //if (content_len > 8)
             //    console.warn("Content length of message is ", content_len);

             // Header
             // SYNC = 0; // -> Provoke Serial Error Message, error 0 - SYNC incorrect, should be 0xA4

             headerBuffer.writeUInt8(ANT.prototype.SYNC, 0);
             headerBuffer.writeUInt8(content_len, 1);
             headerBuffer.writeUInt8(message.id, 2);

             // Content
             for (var byteNr = 0; byteNr < content_len; byteNr++)
                 contentBuffer.writeUInt8(content.readUInt8(byteNr), byteNr);

             messageBuffer = Buffer.concat([headerBuffer, contentBuffer], 3 + content_len);

             // Checksum
             //console.log("Message buffer:", messageBuffer, "Message buffer length", messageBuffer.length, " content length: ", content_len, "content buffer: ", contentBuffer);

             var checksum = messageBuffer.readUInt8(0);
             //console.log("Start checksum", checksum);
             for (byteNr = 1; byteNr < messageBuffer.length; byteNr++) {
                 checksum = checksum ^ messageBuffer.readUInt8(byteNr)
                 //console.log("Checksum", checksum, "byte nr", byteNr, "value:", messageBuffer.readUInt8(byteNr));
             }

             //checksum = 0; // -> Provoke Serial Error Message, error 2 - checksum of ANT msg. incorrect
             messageBuffer = Buffer.concat([messageBuffer, new Buffer([checksum])], 4 + content_len);

             //console.log("Checksum  : " + checksum);
             //console.log("Raw message length : " + msg.length+", content length: "+content_len);

             // Add trailing zeroes - seems to work ok without trailing zeros, but recommended

             if (content_len < 8) {
                 trailingZeroBuffer = new Buffer(8 - content_len - 1); // CRC included in payload
                 for (byteNr = 0; byteNr < 8 - content_len - 1; byteNr++)
                     trailingZeroBuffer.writeUInt8(0, byteNr);

                 messageBuffer = Buffer.concat([messageBuffer, trailingZeroBuffer]);
             }

             //console.log("Created message : ", messageBuffer)


             return {
                 id: message.id,
                 buffer: messageBuffer,
                 friendly: message.friendly
             }
       },

        parseCapabilities : function (data) {
                var maxANTChannels = data[3],
                    maxNetworks = data[4],
                    standardOptions = data[5],
                    advancedOptions = data[6],
                    advancedOptions2 = data[7],
                    advancedOptions3 = data[8],
                        self = this;

   //console.log("self in parseCapabilities is", self);
   self.capabilities = {

       maxANTchannels: maxANTChannels,
       maxNetworks: maxNetworks,

       raw: {
           standardOptions: standardOptions,
           advancedOptions: advancedOptions,
           advancedOptions2: advancedOptions2,
           advancedOptions3: advancedOptions3
       },

       options: {

           CAPABILITIES_NO_RECEIVE_CHANNELS: standardOptions & 0x01,
           CAPABILITIES_NO_TRANSMIT_CHANNELS: standardOptions & 0x02,
           CAPABILITIES_NO_RECEIVE_MESSAGES: standardOptions & (1 << 3),
           CAPABILITIES_NO_TRANSMIT_MESSAGES: standardOptions & (1 << 4),
           CAPABILITIES_NO_ACKD_MESSAGES: standardOptions & (1 << 5),
           CAPABILITIES_NO_BURST_MESSAGES: standardOptions & (1 << 6),

           CAPABILITIES_NETWORK_ENABLED: advancedOptions & 0x02,
           CAPABILITIES_SERIAL_NUMBER_ENABLED: advancedOptions & (1 << 4),
           CAPABILITIES_PER_CHANNEL_TX_POWER_ENABLED: advancedOptions & (1 << 5),
           CAPABILITIES_LOW_PRIORITY_SEARCH_ENABLED: advancedOptions & (1 << 6),
           CAPABILITIES_SCRIPT_ENABLED: advancedOptions & (1 << 7),
           CAPABILITIES_SEARCH_LIST_ENABLED: advancedOptions & (1 << 8),

           CAPABILITIES_LED_ENABLED: advancedOptions2 & 0x01,
           CAPABILITIES_EXT_MESSAGE_ENABLED: advancedOptions2 & 0x02,
           CAPABILITIES_SCAN_MODE_ENABLED: advancedOptions2 & (1 << 3),
           CAPABILITIES_PROXY_SEARCH_ENABLED: advancedOptions2 & (1 << 5),
           CAPABILITIES_EXT_ASSIGN_ENABLED: advancedOptions2 & (1 << 6),
           CAPABILITIES_FS_ANTFS_ENABLED: advancedOptions2 & (1 << 7),

           CAPABILITIES_ADVANCED_BURST_ENABLED: advancedOptions3 & 0x01,
           CAPABILITIES_EVENT_BUFFERING_ENABLED: advancedOptions3 & 0x02,
           CAPABILITIES_EVENT_FILTERING_ENABLED: advancedOptions3 & (1 << 3),
           CAPABILITIES_HIGH_DUTY_SEARCH_ENABLED: advancedOptions3 & (1 << 4),
           CAPABILITIES_SELECTIVE_DATA_ENABLED: advancedOptions3 & (1 << 7)
       }
   }

   var msg = "Max channels: " + maxANTChannels + " Max networks: " + maxNetworks + " ";

   for (var prop in self.capabilities.options)
       if (self.capabilities.options[prop])
           msg += prop.substring(13, prop.length - 8) + " "

   //if (log)
   //    console.log(msg);

   self.capabilities.toString = function () { return msg; }

   self.channelConfiguration = new Array(self.capabilities.maxNetworks);

   return self.capabilities;

   },

        getCapabilities: function (callback) {
            var msgId;
            var self = this;

            self.sendOnly(self.request(undefined,self.ANT_MESSAGE.capabilities.id),
                ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT,
               // function validation(data) { msgId = data[2]; return (msgId === self.ANT_MESSAGE.capabilities.id); },
                function error() { console.log("Failed to get device capabilities."); callback(); },
                function success() {
                    self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, callback,
                        function success(data) {
                            var msgId = data[2];
                            if (msgId !== self.ANT_MESSAGE.capabilities.id)
                                console.warn("Expected capabilities message response", data);
                            self.parse_response(data);
                            if (typeof callback === "function")
                                callback();
                            else
                                console.warn("Found no callback after getCapabilities");
                        });
                });
        },

        getANTVersion : function(callback)  {
            var msgId;
            var self = this;
    
            self.sendOnly(self.request(undefined,self.ANT_MESSAGE.ANT_version.id),
                ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT,
                //function validation(data) { msgId = data[2]; return (msgId === self.ANT_MESSAGE.ANT_version.id); },
                function error() { console.log("Failed to get ANT version."); callback(); },
                function success() {
                    self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, callback,
                       function success(data) {
                           var msgId = data[2];
                           if (msgId !== self.ANT_MESSAGE.ANT_version.id)
                               console.warn("Expected version message response", data);
                           self.parse_response(data);
                           if (typeof callback === "function")
                               callback();
                           else
                               console.warn("Found no callback after getANTVersion");
                       });

                });
        },

          parseDeviceSerialNumber : function (data) {
                // SN 4 bytes Little Endian
                var sn = data.readUInt32LE(3),
                  msg = "Serial number: " + sn,
                    self = this;

                self.serialNumber = sn;

                if (log)
                    console.log(msg);

                return msg;
            },

        getDeviceSerialNumber: function (callback) {
            var msgId;
            var self = this;

            if (typeof self.capabilities === "undefined") {
                console.error("getCapabilities should be run first to determine if device supports serial number");
            } else if (self.capabilities.options.CAPABILITIES_SERIAL_NUMBER_ENABLED)
                self.sendOnly(self.request(undefined,self.ANT_MESSAGE.device_serial_number.id),
                    ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT,
                    //function validation(data) { msgId = data[2]; return (msgId === self.ANT_MESSAGE.device_serial_number.id); },
                    function error() { console.log("Failed to get device serial number"); callback(); },
                    function success() {
                        self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, callback,
                       function success(data) {
                           var msgId = data[2];
                           if (msgId !== self.ANT_MESSAGE.device_serial_number.id)
                               console.warn("Expected device serial number message response", data);

                           self.parse_response(data); 
                           if (typeof callback === "function")
                               callback();
                           else
                               console.warn("Found no callback after getDeviceSerialNumber");
                       });
                    });
            else
                console.warn("Device does not have a serial number");
        },

        // Called on first receive of broadcast from device/master
        getUpdatedChannelID: function (channelNr,errorCallback,successCallback) {
            var msgId, self = this;

            self.sendOnly(self.request(channelNr,self.ANT_MESSAGE.set_channel_id.id),
                ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT,
                //function validation(data) { msgId = data[2]; return (msgId === ANT_MESSAGE.set_channel_id.id); },
                function error() {
                    if (typeof errorCallback === "function")
                        errorCallback();
                    else
                        console.warn("Found no error callback");
                },
                function success() {
                    self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                       function success(data) {
                           var msgId = data[2];
                           if (msgId !== ANT.prototype.ANT_MESSAGE.set_channel_id.id)
                               console.warn("Expected set channel id message response", data);
                           self.parse_response(data);
                           if (typeof successCallback === "function")
                               successCallback(data);
                           else
                               console.warn("Found no success callback");
                       });
                });
        },

        // p. 89 ANT Message Protocol and Usage, Rv 5.0b
        // NVM not implemented
        request: function (channelNr, msgID) {
            var channelNumber = channelNr || 0;

             return  this.create_message(this.ANT_MESSAGE.request, new Buffer([channelNumber, msgID]));
        },

        isStartupNotification : function (data) {
        var msgId = data[2];
                 return (msgId === this.ANT_MESSAGE.startup.id);
        },

        resetSystem : function (errorCallback, successCallback) {

            var reset_system_msg = this.create_message(this.ANT_MESSAGE.reset_system, new Buffer([0])),
                self = this;
            self.sendOnly(reset_system_msg,
                ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT,
                   // function validation(data) { return self.isStartupNotification(data); },
                    function error() { console.log("Could not reset device, try to reinsert USB stick to clean up buffers and drivers."); errorCallback(); },
                    function success() {
                        self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                            function success(data) {
                                if (!self.isStartupNotification(data))
                                    console.warn("Expected a startup notification after RESET command",data);
                                self.parse_response(data);
                                //console.log("Reset system OK");
                                successCallback();
                            });
                        // setTimeout(function () { successCallback() }, 500);

                });
    },

        exit : function ()
        {
            var self = this;

            if (self.inTransfer) {
                console.log("Canceling transfer on in endpoint");
                self.inTransfer.cancel();
            }

            if (self.outTransfer) {
                console.log("Canceling transfer on out endpoint");
                self.outTransfer.cancel();
            }

            self.antInterface.release(function (error) {
                if (error) console.log("Problem with release of interface: ",error)
                  else
                    console.log("Released interface");
                
                setTimeout(function () {
                        console.log("Closing device, removing interface, exiting...");
                        self.device.close(); process.exit()
                        },500);
            });
        },

        read: function (timeout,errorCallback, successCallback) {
            var self = this;
            var channelNr;
            // var inTransfer;
            
            self.device.timeout = timeout; // Don't timeout/give up receiving data

            //function retry() {try


                self.inTransfer = self.inEP.transfer(ANT.prototype.DEFAULT_ENDPOINT_PACKET_SIZE, function (error, data) {
                    if (error) 
                        errorCallback(error);

                    //console.log(Date.now() + "Receive: ", error);
                    ////console.log(usb);
                    //if (error.errno !== usb.LIBUSB_TRANSFER_CANCELLED) // May be aborted by pressing Ctrl-C in Node.js
                    //    process.nextTick(retry); // Recursion
                    ////retry();
                  else
                    successCallback(data);
                    //else {
                    //    //console.log(Date.now()+ "Received ");
                    //    //console.log(data);
                    //    parse_response.call(self, data);
                    //    process.nextTick(retry);
                    //    //retry();
                    //}
                });
            //}

            //retry();
        },

        // Noticed that in endpoint buffers are not cleared sometimes when stopping application using Ctrl-C -> process SIGINT -> exit
        // Max. buffer size = 64 on in endpoint
        tryCleaningBuffers : function (callback)
        {
            var self = this;
            var retries = 0, bytes = 0;
            //console.log(self.device);

            self.device.timeout = ANT.prototype.ANT_DEVICE_TIMEOUT;

            function retry()
            {
                self.inEP.transfer(ANT.prototype.DEFAULT_ENDPOINT_PACKET_SIZE, function inTransferCallback(error, data) {
                    if (error) {
                        if (error.errno !== usb.LIBUSB_TRANSFER_TIMED_OUT) {
                            console.log(Date.now() + "Error:", error);
                            retries++;
                            retry();
                            //process.nextTick.call(self, self.tryCleaningBuffers);
                        }
                        else {
                            if (bytes > 0)
                                console.log("Discarded %d bytes from libusb buffers on in endpoint.", bytes);
                            callback(); // No more data, timeout
                        }
                    }
                    else {
                        //console.log("Discarding buffer data:", data, data.length)
                        bytes += data.length;
                        retries++;
                        retry();
                    }
                });
            }

            retry();

        },

        init: function (errorCallback, callback) {
            var self = this;
            //  usb.setDebugLevel(3);

            //var idVendor = 4047, idProduct = 4104; // Garmin USB2 Wireless ANT+

            self.device = usb.findByIds(self.idVendor, self.idProduct);

            if (typeof self.device === "undefined") {
                console.log("Could not find USB ANT device vendor id:" + self.idVendor + " product id.:" + self.idProduct);
                errorCallback();
            } else {
                console.log("Found device  on bus " + self.device.busNumber + " address " + self.device.deviceAddress + ", max packet size endpoint 0 for control: " + self.device.deviceDescriptor.bMaxPacketSize0 + " bytes, default transfer (non-stream) timeout ms.: " + self.device.timeout + ", packet size for endpoints in/out 64 bytes");

                console.log("Opening interface on device GARMIN USB2 ANT+ wireless/nRF24AP2 (Dynastream Innovations Inc.)")
                console.log("Vendor id: " + self.idVendor + " Product id: " + self.idProduct);

                self.device.open(); // Init/get interfaces of device
                //console.log("Default timeout for native libusb transfer is :" + ant.timeout);

                self.antInterface = self.device.interface();
                if (typeof self.antInterface === "undefined") {
                    console.log("Could not get interface to ant device, aborting");
                    errorCallback();
                } else
                    console.log("Found default interface, it has " + self.antInterface.endpoints.length + " endpoints ");

                if (self.antInterface.endpoints.length < 2) {
                    console.log("Normal operation require 2 endpoints for in/out communication with ANT device");
                    errorCallback();
                }

                // http://www.beyondlogic.org/usbnutshell/usb5.shtml
                self.inEP = self.antInterface.endpoints[0]; // Control endpoint
                if (self.inEP.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK)
                    var inTransferType = "BULK (" + self.inEP.transferType + ')';

                self.outEP = this.antInterface.endpoints[1];
                if (self.outEP.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK)
                    var outTransferType = "BULK (" + self.outEP.transferType + ')';

                // Shared endpoint number in/control and out
                console.log("Number for endpoint: " + (self.inEP.address & 0xF) + " Control/in " + inTransferType + " - " + (self.outEP.address & 0xF) + " " + self.outEP.direction + " " + outTransferType);

                console.log("Claiming interface");
                self.antInterface.claim(); // Must call before attempting transfer on endpoints

                //self.listen();

              //  console.log("Cleaning LIBUSB in endpoint buffers....");

                self.tryCleaningBuffers(
                    function () {
                        self.resetSystem(errorCallback, function _getCapabilities() {

                            self.getCapabilities(function _getANTVersion() {
                                self.getANTVersion(function _getDeviceSerialNumber() {
                                    self.getDeviceSerialNumber(callback);
                                })
                            })
                        });
                    });
                    
                    //});
                //});
                // Setup in endpoint event listeners

                //inEP.addListener('data', function (data) {
                //    var timestamp = Date.now();
                //    console.log(timestamp);
                //    parse_response(data);
                //});

                //inEP.addListener('error', function (error) {
                //    console.error("inEndpoint error "+error);
                //});

                //inEP.addListener('end', function (error) {
                //    console.log("In endpoint received END event"); // stopStream must be called before
                //});

                //console.log("Starting instream with max packet size: "+ant.deviceDescriptor.bMaxPacketSize0);
                //inEP.startStream(5, ant.deviceDescriptor.bMaxPacketSize0/2);

                ////// Setup out endpoint event listeners

                //outEP.addListener('drain', function (data) {
                //    console.log(Date.now()+" Drain");
                //});

                //outEP.addListener('error', function (error) {
                //    console.error("outEndpoint error " + error);
                //});

                //outEP.addListener('end', function (error) {
                //    console.log("Out endpoint received END event"); // stopStream must be called before
                //});

                //console.log("Starting outstream...");
                //outEP.startStream(5, ant.deviceDescriptor.bMaxPacketSize0 / 2);
            }
        },

        configure : function (channelConfNr, errorCallback, successCallback)
        {
            var self = this;
            var channel = self.channelConfiguration[channelConfNr];

            console.log("Configuring : ", channelConfNr);

            self.setNetworkKey(channelConfNr,
                     function () { console.log("Failed to set network key.", channel.network) },
                     function (data) {
                        // console.log("Set network key OK ");
                         self.assignChannel(channelConfNr,
                             function () { console.log(Date.now() + " Could not assign channel ", channel); errorCallback(); },
                             function (data) {
                                 //console.log(Date.now() + " Assign channel OK");
                                 self.setChannelId(channelConfNr,
                                     function () { console.log(Date.now() + " Could not set channel id ", channel); errorCallback(); },
                                      function (data) {
                                          //console.log(Date.now() + " Set channel id OK ");
                                          self.setChannelPeriod(channelConfNr,
                                             function () { console.log(Date.now() + " Could not set period ", channel); errorCallback(); },
                                              function (data) {
                                                  //console.log(Date.now() + " Set channel period OK ");

                                                  self.setChannelSearchTimeout(channelConfNr,
                                                         function () { console.log(Date.now() + " Could not channel searchtimeout ", channel); errorCallback(); },
                                                          function (data) {
                                                              //console.log(Date.now() + " Set channel search timeout OK");

                                                              self.setChannelRFFrequency(channelConfNr,
                                                                     function () { console.log(Date.now() + " Could not set RF frequency ", channel); errorCallback(); },
                                                                      function (data) {
                                                                         // console.log(Date.now() + " Set channel RF frequency OK");
                                                                          if (typeof channel.searchWaveform !== "undefined") {
                                                                              self.setSearchWaveform(channelConfNr,
                                                                                 function () { console.log(Date.now() + " Could not channel search waveform ", channel); errorCallback(); },
                                                                                 function (data) {
                                                                                    // console.log(Date.now() + " Set channel search waveform OK");
                                                                                     successCallback();
                                                                                 });
                                                                          } else
                                                                              successCallback();
                                                                      });
                                                          });
                                              });
                                      });
                             });
                     });

        },

      


        setNetworkKey: function (channelConfNr, errorCallback, successCallback) {
            var self = this;
            var channel = this.channelConfiguration[channelConfNr];

            console.log("Setting network key on net " + channel.network.number + " key: " + channel.network.key);
           
            self.sendOnly(this.create_message(this.ANT_MESSAGE.set_network_key, Buffer.concat([new Buffer([channel.network.number]), new Buffer(channel.network.key)])),
            ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback, 
             function success() {
                 self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                      function success(data) {
                          if (!self.isResponseNoError(data, self.ANT_MESSAGE.set_network_key.id))
                              console.warn("Expected response NO ERROR", data);

                          self.parse_response(data);
                          successCallback();
                      });
             }
            );
        },

        assignChannel: function (channelConfNr,errorCallback, successCallback) {
           
            var channel = this.channelConfiguration[channelConfNr], self = this;

            console.log("Assign channel nr. " + channel.number + " to channel type " + Channel.prototype.CHANNEL_TYPE[channel.channelType]
                + "(" + channel.channelType + ")" + " on network nr.:" + channel.network.number);

            // Assign channel command should be issued before any other channel configuration messages (p. 64 ANT Message Protocol And Usaga Rev 50) ->
            // also sets defaults values for RF, period, tx power, search timeout p.22
            this.sendOnly(this.create_message(this.ANT_MESSAGE.assign_channel, new Buffer([channel.number, channel.channelType, channel.network.number])),
                ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback, 
                function success() {
                    self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                         function success(data) {
                             if (!self.isResponseNoError(data, self.ANT_MESSAGE.assign_channel.id))
                                 console.warn("Expected response NO ERROR", data);

                             self.parse_response(data);
                             successCallback();
                         });
                }
                );
                
        },

        setChannelId : function (channelConfNr,errorCallback, successCallback) {

            //(false, 0, 0, 0, 0),  // Search, no pairing   
            //                        DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
            //                        function () { exit("Failed to set channel id.") },
            // ANTWARE II - log file   1061.985 { 798221031} Tx - [A4][05][51][00][00][00][78][00][88][00][00]

            var set_channel_id_msg, self = this;
            var channel = this.channelConfiguration[channelConfNr];
            console.log("Setting channel id. - channel number " + channel.number + " device type " + channel.deviceType + " transmission type " + channel.transmissionType);

            var buf = new Buffer(5);
            buf[0] = channel.number;
            buf.writeUInt16LE(channel.deviceNumber, 1); // If slave 0 matches any device number / dev id.
           // Seems like its not used at least for slave?  buf[3] = channel.deviceType & 0x80; // If bit 7 = 1 -> master = request pairing, slave = find pairing transmitter -> (pairing bit)
            // Pairing bit-set in Channel object, if pairing requested deviceType = deviceType | 0x80;
            buf[3] = channel.deviceType
            buf[4] = channel.transmissionType; // Can be set to zero (wildcard) on a slave device, spec. p. 18 ANT Message Protocol and Usage, rev 5.0

            set_channel_id_msg = this.create_message(this.ANT_MESSAGE.set_channel_id, buf);
            self.sendOnly(set_channel_id_msg, ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback, 
                function success() {
                    self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                         function success(data) {
                             if (!self.isResponseNoError(data, self.ANT_MESSAGE.set_channel_id.id))
                                 console.warn("Expected response NO ERROR", data);
                             self.parse_response(data);
                             successCallback();
                         });
                }
                );
                  
        },

        setChannelPeriod : function (channelConfNr,errorCallback, successCallback) {

            var set_channel_period_msg, rate, self = this;
            var channel = this.channelConfiguration[channelConfNr];

            console.log("Set channel period for channel " +channel.number+ " to " +  channel.periodFriendly+ " value: "+channel.period);

            var buf = new Buffer(3);
            buf[0] = channel.number;
            buf.writeUInt16LE(channel.period, 1);

            set_channel_period_msg = this.create_message(this.ANT_MESSAGE.set_channel_messaging_period, new Buffer(buf));

            this.sendOnly(set_channel_period_msg, ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback, 
                function success() {
                    self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                         function success(data) {
                             if (!self.isResponseNoError(data, self.ANT_MESSAGE.set_channel_messaging_period.id))
                                 console.warn("Expected response NO ERROR", data);
                             self.parse_response(data);
                             successCallback();
                         });
                }
                );
        },

        setChannelSearchTimeout: function (channelConfNr, errorCallback, successCallback) {

            // Each count in ucSearchTimeout = 2.5 s, 255 = infinite, 0 = disable high priority search mode
            var channel_search_timeout_msgt, self = this;
            var channel = this.channelConfiguration[channelConfNr];

            console.log("Set channel search timeout channel nr. " + channel.number + " timeout : " + channel.searchTimeout);

            channel_search_timeout_msg = this.create_message(this.ANT_MESSAGE.set_channel_search_timeout, new Buffer([channel.number, channel.searchTimeout]));

            this.sendOnly(channel_search_timeout_msg, ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                function success() {
                    self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                         function success(data) {
                             if (!self.isResponseNoError(data, self.ANT_MESSAGE.set_channel_search_timeout.id))
                                 console.warn("Expected response NO ERROR", data);
                             self.parse_response(data);
                             successCallback();
                         });
                }
                );
        },

        setChannelRFFrequency : function (channelConfNr,errorCallback, successCallback) {
            // ucRFFreq*1Mhz+2400 Mhz
            var RFFreq_msg, self = this ;
            var channel = this.channelConfiguration[channelConfNr];

            console.log("Set channel RF frequency channel nr. " + channel.number + " frequency value: " + channel.RFfrequency);
            RFFreq_msg = this.create_message(this.ANT_MESSAGE.set_channel_RFFreq, new Buffer([channel.number, channel.RFfrequency]));
            this.sendOnly(RFFreq_msg, ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback, 
                function success() {
                    self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                         function success(data) {
                             if (!self.isResponseNoError(data, self.ANT_MESSAGE.set_channel_RFFreq.id))
                                 console.warn("Expected response NO ERROR", data);
                             self.parse_response(data);
                             successCallback();
                         });
                }
                );
        },

        setSearchWaveform : function (channelConfNr,errorCallback, successCallback) {
            // waveform in little endian!
          
            var set_search_waveform_msg, self = this,
                buf = new Buffer(3);
            var channel = this.channelConfiguration[channelConfNr];

            if (typeof channel.searchWaveform === "undefined") {
                console.error("No search waveform specified");
                errorCallback();
            }

            console.log("Set channel search waveform channel nr. " + channel.number + " waveform :" + channel.searchWaveform);

            buf[0] = channel.number;
            buf[1] = channel.searchWaveform[0];
            buf[2] = channel.searchWaveform[1];
            set_search_waveform_msg = this.create_message(this.ANT_MESSAGE.set_search_waveform, new Buffer(buf));
            this.sendOnly(set_search_waveform_msg, ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback, 
                function success() {
                    self.read(ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback,
                         function success(data) {
                             if (!self.isResponseNoError(data, self.ANT_MESSAGE.set_search_waveform.id))
                                 console.warn("Expected response NO ERROR", data);
                             self.parse_response(data);
                             successCallback();
                         });
                }
                );
        },

        open : function (channelConfNr,errorCallback, successCallback) {
    //console.log("Opening channel "+ucChannel);
            var open_channel_msg;
            var channel = this.channelConfiguration[channelConfNr];
            console.log("Opening channel nr. " + channel.number);
        open_channel_msg = this.create_message(this.ANT_MESSAGE.open_channel, new Buffer([channel.number]));
        this.sendOnly(open_channel_msg, ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback, successCallback);
    },

        close : function (channelConfNr,errorCallback, successCallback) {
        //console.log("Closing channel "+ucChannel);
            var close_channel_msg;
            var channel = this.channelConfiguration[channelConfNr];
            console.log("Closing channel nr. " + channel.number);
        close_channel_msg = this.create_message(this.ANT_MESSAGE.close_channel, new Buffer([channel.number]));
        this.sendOnly(close_channel_msg, ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback, successCallback);
        },

        //Rx:  <Buffer a4 03 40 01 01 05 e2> Channel Response/Event EVENT on channel 1 EVENT_TRANSFER_TX_COMPLETED
        //Rx:  <Buffer a4 03 40 01 01 06 e1> Channel Response/Event EVENT on channel 1 EVENT_TRANSFER_TX_FAILED
        isEvent : function (code, data)
        {
            var msgId = data[2], channelNr = data[3], eventOrResponse = data[4], eventCode = data[5], EVENT = 1;

            return (msgId === ANT.prototype.ANT_MESSAGE.channel_response.id && eventOrResponse === EVENT && code === eventCode)
        },

        isResponseNoError: function (data, requestedMsgId) {
             var msgId = data[2], msgRequested = data[4], msgCode = data[5];

             //console.log(Date.now() + " Validation");
             //console.log(data, requestedMsgId);
           
             return (msgId === ANT.prototype.ANT_MESSAGE.channel_response.id && msgCode === ANT.prototype.RESPONSE_EVENT_CODES.RESPONSE_NO_ERROR && msgRequested === requestedMsgId);
     
         },

        // p. 96 ANT Message protocol and usave rev. 5.0
        // TRANSFER_TX_COMPLETED channel event if successfull, or TX_TRANSFER_FAILED -> msg. failed to reach master or response from master failed to reach the slave -> slave may retry
        // 3rd option : GO_TO_SEARCH is received if channel is droppped -> channel should be unassigned
         sendAcknowledgedData: function (ucChannel, pucBroadcastData, errorCallback, successCallback) {
             var buf = Buffer.concat([new Buffer([ucChannel]), pucBroadcastData]), self = this;

             var ack_msg = self.create_message(ANT.prototype.ANT_MESSAGE.acknowledged_data, buf);

             // TO DO : this.send(ack_msg, ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, this.isResponseNoError, errorCallback, successCallback, false);
             this.sendOnly(ack_msg, ANT.prototype.ANT_DEFAULT_RETRY, ANT.prototype.ANT_DEVICE_TIMEOUT, errorCallback, successCallback);
         },

         send : function (message, maxRetries, timeout, validationCallback, errorCallback, successCallback, skipReceive) {

             var maxReceiveErrorRetries = maxRetries,
                 maxSendRetries = maxRetries,
                 startTimestamp = Date.now(),
                 self = this;
                       
             //console.trace();

                this.device.timeout = timeout;

                function retry() {

                    if (maxSendRetries === 0) {
                        console.log("Calling error callback - too many send retries");
                        errorCallback();
                    }

                    function receive()
                    {
                        if (maxReceiveErrorRetries === 0) {
                            console.log("Calling error callback - too many receive retries");
                            errorCallback();
                        }

                        self.inTransfer = self.inEP.transfer(ANT.prototype.DEFAULT_ENDPOINT_PACKET_SIZE, function inTransferCallback(error, data) {
                            if (error) {
                                console.log(Date.now() + " Receive (after send): " + error + ", retrying...");
                                --maxReceiveErrorRetries;
                                receive(); // Just retry receive
                            }
                            else {
                              
                                if (!validationCallback(data, message.id)) {
                                    // console.log("Expected startup notification after reset command, but got " + RESPONSE_EVENT_CODES[data[2]] + ", retrying...");
                                    //--maxReceiveErrorRetries;
                                    console.log(Date.now() + " Waiting on response for "+ANT.prototype.ANT_MESSAGE[message.id]+", skipping this message; ",data);
                                    //console.log(self);
                                    self.parse_response(data);
                                    if (Date.now() - startTimestamp > 10000) {
                                        console.log("Validation timeout");
                                        errorCallback();
                                    }
                                    else
                                        receive();
                                } else {
                                    console.log(Date.now() + " (post-validation) Received: ",data);
                                    successCallback(data);
                                }
                            }

                        })
                    }
       
                    console.log(Date.now()+" Sending:" + message.friendly + " timeout " + timeout + " max retries " + maxRetries+ " skip receive : " ,skipReceive ? "yes " : "no ",message.buffer);

                    // console.log("Transfering " + message.friendly);
                    //console.log("THIS", this);
                    self.outTransfer = self.outEP.transfer(message.buffer, function outTransferCallback(error) {
                        if (error) {
                            console.log(Date.now() + "Send: " + error + ", retrying...");
                            retry(--maxSendRetries);
                        }
                        else if (typeof skipReceive === "undefined" || !skipReceive)
                            receive();
                        else
                            successCallback(undefined);
                    });
                }

                retry(maxSendRetries);
         },

         sendOnly: function (message, maxRetries, timeout, errorCallback, successCallback) {
             var self = this,
                 msg = "", request = "";

            // console.log(message.id, ANT.prototype.ANT_MESSAGE.request);
             if (message.id === ANT.prototype.ANT_MESSAGE.request.id)
                 request = ANT.prototype.ANT_MESSAGE[message.buffer[4]];

             console.log(Date.now() + " TX: ", message.buffer, " "+message.friendly + " "+request +" timeout " + timeout + " max retries " + maxRetries);

             if (typeof successCallback === "undefined")
                 console.trace();

             this.device.timeout = timeout;

             function retry(retryNr) {

                     self.outTransfer = self.outEP.transfer(message.buffer, function outTransferCallback(error) {
                         if (error) { // LIBUSB errors
                             console.log(Date.now() + " Send error: ", error, ", retrying...");
                             retryNr -= 1;
                             if (retryNr > 0)
                                 retry(retryNr);
                             else {
                                 if (typeof errorCallback !== "undefined")
                                     errorCallback(error);
                                 else {
                                     console.error("Error callback is undefined");
                                     console.trace();
                                 }
                             }
                         }
                         else {
                             if (typeof successCallback !== "undefined")
                                 successCallback();
                             else {
                                 console.error("Success callback is undefined");
                                 //console.trace();
                             }

                         }
                     });
             }

             retry(maxRetries); 
         }

 }

 var ANTNode = new Node(); // Let's start ANT node
   