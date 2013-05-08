
function ANTMessage(channel) {
    this.channel = channel;
}

ANTMessage.prototype.assignChannel = function () {
    // Assign channel command should be issued before any other channel configuration messages (p. 64 ANT Message Protocol And Usaga Rev 50)
    return create_message(ANT_MESSAGE.assign_channel, new Buffer([this.channel.number, this.channel.channelType, this.channel.network]));
}

ANTMessage.prototype.unAssignChannel = function () {
    return create_message(ANT_MESSAGE.unassign_channel, new Buffer([this.channel.number]));
}


function ANT_AssignChannel(writeToStream, ucChannel, ucChannelType, ucNetworkNumber) {

    var assign_channel_msg;

    ANTFS_HOST.channel.number = ucChannel;
    ANTFS_HOST.channel.channelType = ucChannelType;
    ANTFS_HOST.network = ucNetworkNumber;

    // Assign channel command should be issued before any other channel configuration messages (p. 64 ANT Message Protocol And Usaga Rev 50)
    assign_channel_msg = create_message(ANT_MESSAGE.assign_channel, new Buffer([ucChannel, ucChannelType, ucNetworkNumber]));

    if (writeToStream)
        outEP.write(assign_channel_msg.buffer);

    return assign_channel_msg;
}

function ANT_UnAssignChannel(writeToStream, ucChannel) {

    var unassign_channel_msg;

    unassign_channel_msg = create_message(ANT_MESSAGE.unassign_channel, new Buffer([ucChannel]));


    return unassign_channel_msg;
}

function ANT_SetChannelId(writeToStream, ucChannel, usDeviceNum, ucDeviceType, ucTransmissionType) {
    var set_channel_id_msg;

    ANTFS_HOST.channel.number = ucChannel;
    ANTFS_HOST.channel.deviceNumber = usDeviceNum;
    ANTFS_HOST.channel.deviceType = ucDeviceType;
    ANTFS_HOST.channel.tranmissionType = ucTransmissionType;

    var buf = new Buffer(6);
    buf[0] = ucChannel;
    buf.writeUInt16LE(usDeviceNum, 1); // If slave 0 matches any device number
    buf[3] = ucDeviceType & 0x80; // If bit 7 = 1 ->pairing
    buf[4] = ucDeviceType & 0x7F; // bit 6-0
    buf[5] = ucTransmissionType;

    set_channel_id_msg = create_message(ANT_MESSAGE.set_channel_id, new Buffer(buf));
    if (writeToStream)
        outEP.write(set_channel_id_msg.buffer);

    return set_channel_id_msg;
}

function ANT_SetChannelPeriod(writeToStream, ucChannel, usMessagePeriod) {

    var set_channel_period_msg, rate;

    ANTFS_HOST.channel.number = ucChannel;
    ANTFS_HOST.channel.period = usMessagePeriod;


    switch (usMessagePeriod) {
        case 65535: rate = "0.5 Hz (65535)"; break;
        case 32768: rate = "1 Hz (32768)"; break;
        case 16384: rate = "2 Hz (16384)"; break;
        case 8192: rate = "4 Hz (8192)"; break;
        case 4096: rate = "8 Hz (4096)"; break;
        default: rate = "Warning - unknown channel period - " + usMessagePeriod; break;
    }

    ANTFS_HOST.channel.periodFriendly = rate;

    console.log("Setting channel period to " + rate);

    var buf = new Buffer(3);
    buf[0] = ucChannel;
    buf.writeUInt16LE(usMessagePeriod, 1);

    set_channel_period_msg = create_message(ANT_MESSAGE.set_channel_messaging_period, new Buffer(buf));

    if (writeToStream)
        outEP.write(set_channel_period_msg.buffer);

    return set_channel_period_msg;
}

function ANT_SetChannelSearchTimeout(writeToStream, ucChannel, ucSearchTimeout) {
    // Each count in ucSearchTimeout = 2.5 s, 255 = infinite, 0 = disable high priority search mode
    var channel_search_timeout_msg, friendlyFormat;
    ANTFS_HOST.channel.number = ucChannel;
    ANTFS_HOST.channel.searchTimeout = ucSearchTimeout;


    switch (ucSearchTimeout) {
        case 0:
            friendlyFormat = "Setting search timeout for channel " + ucChannel + " to " + ucSearchTimeout + " = Disable high priority searcg mode";
            break;
        case 255:
            friendlyFormat = "Setting search timeout for channel " + ucChannel + " to " + ucSearchTimeout + " = Infinite search";
            break;
        default:
            friendlyFormat = "Setting search timeout for channel " + ucChannel + " to " + ucSearchTimeout + " = " + ucSearchTimeout * 2.5 + "sec.";
            break;
    }

    ANTFS_HOST.channel.searchTimeoutFriendly = friendlyFormat;

    channel_search_timeout_msg = create_message(ANT_MESSAGE.set_channel_search_timeout, new Buffer([ucChannel, ucSearchTimeout]));
    if (writeToStream)
        outEP.write(channel_search_timeout_msg.buffer);

    return channel_search_timeout_msg;
}

function ANT_SetChannelRFFreq(writeToStream, ucChannel, ucRFFreq) {
    // ucRFFreq*1Mhz+2400 Mhz
    var RFFreq_msg, freq = 2400 + ucRFFreq, friendlyFormat;

    friendlyFormat = "Setting RF frequency to " + freq + " MHz";
    ANTFS_HOST.channel.RFFrequency = friendlyFormat;
    ANTFS_HOST.channel.number = 0;

    RFFreq_msg = create_message(ANT_MESSAGE.set_channel_RFFreq, new Buffer([ucChannel, ucRFFreq]));
    if (writeToStream)
        outEP.write(RFFreq_msg.buffer);

    return RFFreq_msg;
}

function ANT_OpenChannel(writeToStream, ucChannel) {
    //console.log("Opening channel "+ucChannel);
    var open_channel_msg,

    open_channel_msg = create_message(ANT_MESSAGE.open_channel, new Buffer([ucChannel]));
    if (writeToStream)
        outEP.write(open_channel_msg.buffer);

    return open_channel_msg;
}

function ANT_CloseChannel(writeToStream, ucChannel) {
    //console.log("Closing channel "+ucChannel);
    var close_channel_msg,

    close_channel_msg = create_message(ANT_MESSAGE.close_channel, new Buffer([ucChannel]));
    if (writeToStream)
        outEP.write(close_channel_msg.buffer);

    return close_channel_msg;
}

function ANT_SetSearchWaveform(writeToStream, ucChannel, waveform) {
    // waveform in little endian!
    ANTFS_HOST.channel.number = ucChannel;
    ANTFS_HOST.channel.waveform = waveform;

    var set_search_waveform_msg,
        buf = new Buffer(3);

    buf[0] = ucChannel;
    buf[1] = waveform[0];
    buf[2] = waveform[1];
    set_search_waveform_msg = create_message(ANT_MESSAGE.set_search_waveform, new Buffer(buf));
    if (writeToStream)
        outEP.write(set_search_waveform_msg.buffer);

    return set_search_waveform_msg;
}

function ANT_SetNetworkKey(writeToStream, ucNetNumber, pucKey) {
    // ucRFFreq*1Mhz+2400 Mhz

    ANTFS_HOST.networkNumber = ucNetNumber;
    ANTFS_HOST.networkKey = pucKey;

    var set_network_key_msg,
     buf = new Buffer(1 + 8);

    buf[0] = ucNetNumber;
    // Add key to buffer
    for (var byteNr = 0; byteNr < pucKey.length; byteNr++)
        buf[1 + byteNr] = pucKey[byteNr];

    set_network_key_msg = create_message(ANT_MESSAGE.set_network_key, buf);
    if (writeToStream)
        outEP.write(set_network_key_msg.buffer);

    return set_network_key_msg;
}

//function ANT_ResetSystem(writeToStream) {

//    var reset_system_msg = create_message(ANT_MESSAGE.reset_system, new Buffer([0]));
//    if (writeToStream)
//        outEP.write(reset_system_msg.buffer);

//    return reset_system_msg;
//}

// getCapabilities(function () { getDeviceSerialNumber(function () { getANTVersion(function () { setupChannel(); }) }); });

function setupChannel() {
    //Send in series - wait for valid response before sending data - gives more control than just streaming and assuming everything goes ok -> but streaming gives very clean code...


    // Might be done recursively...using arrays with messages...?
    send(ANT_SetNetworkKey(false, 0, NETWORK_KEY.ANTFS), DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
        function (data) { return isResponseNoError(data, ANT_MESSAGE.set_network_key.id); },
        function () { exit("Failed to set network key.") },
        function (data) {
            console.log("Set network key OK");

            send(ANT_AssignChannel(false, 0, CHANNEL_TYPE.receive_channel, 0), // Slave
                DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
                function (data) { return isResponseNoError(data, ANT_MESSAGE.assign_channel.id); },
                function () { exit("Failed to assign channel.") },

                function (data) {
                    console.log("Assign channel OK");

                    send(ANT_SetChannelId(false, 0, 0, 0, 0),  // Search, no pairing   
                        DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
                        function (data) { return isResponseNoError(data, ANT_MESSAGE.set_channel_id.id); },
                        function () { exit("Failed to set channel id.") },

                        function (data) {
                            console.log("Set channel ID OK");
                            console.log(self);
                            send(ANT_SetChannelPeriod(false, 0, self.DEFAULT_CHANNEL_PERIOD), // 8 Hz - fastest ANT-FS message rate  - 0x1000 -> expect a message each 125 ms
                                DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
                                function (data) { return isResponseNoError(data, ANT_MESSAGE.set_channel_messaging_period.id); },
                                function () { exit("Failed to set channel period") },
                                function (data) {
                                    console.log("Set channel period OK");

                                    send(ANT_SetChannelRFFreq(false, 0, self.DEFAULT_CHANNEL_FREQUENCY), // 0x32 = 24ANT_DEVICE_TIMEOUT Mhz
                                        DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
                                        function (data) { return isResponseNoError(data, ANT_MESSAGE.set_channel_RFFreq.id); },
                                        function () { exit("Failed to set channel RF frequency") },
                                        function (data) {
                                            console.log("Set channel RF frequency OK");

                                            send(ANT_SetChannelSearchTimeout(true, 0, INFINITE_SEARCH),
                                                DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
                                                function (data) { return isResponseNoError(data, ANT_MESSAGE.set_channel_search_timeout.id); },
                                                function () { exit("Failed to set channel search timeout") },
                                                function (data) {
                                                    console.log("Set channel search timeout OK");

                                                    send(ANT_SetSearchWaveform(false, 0, [0x53, 0x00]), // Undocumented...
                                                        DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
                                                        function (data) { return isResponseNoError(data, ANT_MESSAGE.set_search_waveform.id); },
                                                        function () { exit("Failed to set channel search waveform") },
                                                        function (data) {
                                                            console.log("Set channel search waveform OK");

                                                            send(ANT_OpenChannel(false, 0),
                                                               DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
                                                               function (data) { return isResponseNoError(data, ANT_MESSAGE.open_channel.id); },
                                                               function () { exit("Failed open channel") },
                                                               function (data) {
                                                                   //console.log(JSON.stringify(ANTFS_HOST));
                                                                   console.log("Open channel OK");
                                                                   console.log("Searching for LINK beacon from device...");
                                                                   findLinkBeacon(30000, 6, function () {
                                                                       console.log("Could not find LINK beacon. Terminating.");
                                                                       //process.kill(process.pid, 'SIGINT');
                                                                       exitApplication();

                                                                   });
                                                               });
                                                        });
                                                });
                                        });
                                });
                        });
                });
        });

}



function create_message(message, content) {
    var index;

    var headerBuffer = new Buffer(3), contentBuffer, messageBuffer, trailingZeroBuffer;

    var content_len;
    if (content)
        content_len = content.length;
    else {
        console.warn("Content length is 0");
        content_len = 0;
    }

    console.log("Message id. ", message.id, " Content is ", content);

    contentBuffer = new Buffer(content_len);
    if (content_len > 8)
        console.warn("Content length of message is ", content_len);

    // Header
    // SYNC = 0; // -> Provoke Serial Error Message, error 0 - SYNC incorrect, should be 0xA4

    headerBuffer.writeUInt8(SYNC, 0);
    headerBuffer.writeUInt8(content_len, 1);
    headerBuffer.writeUInt8(message.id, 2);

    // Content
    for (var byteNr = 0; byteNr < content_len; byteNr++)
        contentBuffer.writeUInt8(content.readUInt8(byteNr), byteNr);

    messageBuffer = Buffer.concat([headerBuffer, contentBuffer], 3 + content_len);

    // Checksum
    console.log("Message buffer:", messageBuffer, "Message buffer length", messageBuffer.length, " content length: ", content_len, "content buffer: ", contentBuffer);

    var checksum = messageBuffer.readUInt8(0);
    console.log("Start checksum", checksum);
    for (byteNr = 1; byteNr < messageBuffer.length; byteNr++) {
        checksum = checksum ^ messageBuffer.readUInt8(byteNr)
        console.log("Checksum", checksum, "byte nr", byteNr, "value:", messageBuffer.readUInt8(byteNr));
    }

    //checksum = 0; // -> Provoke Serial Error Message, error 2 - checksum of ANT msg. incorrect
    messageBuffer = Buffer.concat([messageBuffer, new Buffer([checksum])], 4 + content_len);

    //console.log("Checksum  : " + checksum);
    //console.log("Raw message length : " + msg.length+", content length: "+content_len);

    // Add trailing zeroes

    //trailingZeroBuffer = new Buffer(8 - content_len);
    //if (content_len < 8)
    //    for (byteNr = 0; byteNr < 8 - content_len; byteNr++)
    //        trailingZeroBuffer.writeUInt8(0, byteNr);

    //messageBuffer = Buffer.concat([messageBuffer, trailingZeroBuffer]);
    console.log("Created message : ", messageBuffer)


    return {
        id: message.id,
        buffer: messageBuffer,
        friendly: message.friendly
    };
}


function create_message(message, content) {
    var content_len;
    if (content)
        content_len = content.length;
    else
        content_len = 0;

    var msg = new Buffer(3 + content_len + 1);

    // Header
    // SYNC = 0; // -> Provoke Serial Error Message, error 0 - SYNC incorrect, should be 0xA4

    msg.writeUInt8(SYNC, 0);
    msg.writeUInt8(content_len, 1);
    msg.writeUInt8(message.id, 2);

    // Content
    for (var byteNr = 0; byteNr < content_len; byteNr++)
        msg.writeUInt8(content.readUInt8(byteNr), 3 + byteNr);

    // Checksum
    var checksum = msg.readUInt8(0);
    for (byteNr = 1; byteNr < msg.length - 1; byteNr++) {
        checksum = checksum ^ msg.readUInt8(byteNr);
        console.log("Checksum", checksum);
    }

    //checksum = 0; // -> Provoke Serial Error Message, error 2 - checksum of ANT msg. incorrect

    msg.writeUInt8(checksum, msg.length - 1);

    //console.log("Checksum  : " + checksum);
    //console.log("Raw message length : " + msg.length+", content length: "+content_len);

    return {
        id: message.id,
        buffer: msg,
        friendly: message.friendly
    };
}


//function send(message, maxRetries, timeout, validationCallback, errorCallback, successCallback, skipReceive) {

//    var maxReceiveErrorRetries = maxRetries,
//        maxSendRetries = maxRetries,
//        startTimestamp = Date.now();
//    //console.trace();

//    //ant.timeout = timeout;

//    function retry() {

//        if (maxSendRetries === 0) {
//            console.log("Calling error callback - too many send retries");
//            errorCallback();
//        }

//        function receive()
//        {
//            if (maxReceiveErrorRetries === 0) {
//                console.log("Calling error callback - too many receive retries");
//                errorCallback();
//            }

//            inEP.transfer(DEFAULT_ENDPOINT_PACKET_SIZE, function (error, data) {
//                if (error) {
//                    console.log(Date.now()+" Receive (after send): " + error + ", retrying...");
//                    --maxReceiveErrorRetries;
//                    receive(); // Just retry receive
//                }
//                else
//                    if (!validationCallback(data)) {
//                        // console.log("Expected startup notification after reset command, but got " + RESPONSE_EVENT_CODES[data[2]] + ", retrying...");
//                        //--maxReceiveErrorRetries;
//                        console.log(Date.now()+" Waiting on specific message/validation, skipping this message");
//                        console.log(data);
//                        parse_response(data);
//                        if (Date.now() - startTimestamp > 10000) {
//                            console.log("Vailidation timeout");
//                            errorCallback();
//                        }
//                        else
//                            receive(); 
//                    } else {
//                        console.log(Date.now()+" (post-validation) Received:");
//                        console.log(data);
//                        successCallback(data);
//                    }

//            })
//        }


//        console.log(Date.now()+" Sending:" + message.friendly + " timeout " + timeout + " max retries " + maxRetries+ " skip receive : " ,skipReceive ? "yes" : "no");
//        console.log(message.buffer);

//        // console.log("Transfering " + message.friendly);
//        outEP.transfer(message.buffer, function (error) {
//            if (error) {
//                console.log(Date.now() + "Send: " + error + ", retrying...");
//                retry(--maxSendRetries);
//            }
//            else if (typeof skipReceive === "undefined" || !skipReceive)
//                receive();
//            else
//                successCallback(undefined);
//        });
//    }

//    retry(maxSendRetries);
//}


//function getDeviceSerialNumber(callback) {
//    var msgId;

//    send(ANT_Request(false, ANT_MESSAGE.device_serial_number.id),
//        DEFAULT_RETRY, ANT_DEVICE_TIMEOUT, 
//        function (data) { msgId = data[2]; return (msgId === ANT_MESSAGE.device_serial_number.id); },
//        function () { console.log("Failed to get device serial number"); callback(); },
//        function (data) { parse_response(data); callback(); });
//}

//function getANTVersion(callback) {
//    var msgId;

//    send(ANT_Request(false, ANT_MESSAGE.ANT_version.id),
//        DEFAULT_RETRY, ANT_DEVICE_TIMEOUT,
//        function (data) { msgId = data[2]; return (msgId === ANT_MESSAGE.ANT_version.id); },
//        function () { console.log("Failed to get ANT version."); callback(); },
//        function (data) { ANTFS_HOST.ANTVersion = data.toString('ascii', 3, 13); parse_response(data); callback(); });
//}

//function getCapabilities(callback) {
//    var msgId;

//    send(ANT_Request(false, ANT_MESSAGE.capabilities.id),
//        DEFAULT_RETRY, ANT_DEVICE_TIMEOUT, 
//        function validation (data) { msgId = data[2]; return (msgId === ANT_MESSAGE.capabilities.id); },
//        function error() { console.log("Failed to get device capabilities."); callback(); },
//        function success(data) { parse_response(data); callback(); });
//}


//function isResponseNoError(data,requestedMsgId) {
//    var msgId = data[2], msgRequested = data[4], msgCode = data[5];

//    return (msgId === ANT_MESSAGE.channel_response.id && msgCode === ANT.prototype.RESPONSE_EVENT_CODES.RESPONSE_NO_ERROR && msgRequested === requestedMsgId);

//}

//function isStartupNotification(data) {
//    var msgId = data[2];

//    return (msgId === ANT_MESSAGE.startup.id);
//}

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
        default: rate = "Warning - unknown channel period - " + usMessagePeriod + (32768 / usMessagePeriod).toFixed(2)+" Hz"; break;
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



function isTransferTxCompleted(data) {
    var msgId = data[2],
        channelNr = data[3],
        responseToMsgId = data[4],
        msgCode = data[5]
}


// Get potential errors from LIBUSB
function errCallback(error) {
    if (typeof error !== "undefined")
        console.log("Error callback "+error);
}

//var reset_msg = create_message(ANT_MESSAGE.reset_system, new Buffer([0])); // Low-power state, terminate all channels
////write(reset_msg, errCallback, false, true, 500); // Wait 500ms on reset
//outEP.write(reset_msg.buffer);

//setInterval(function () {
//    reset_msg = create_message(ANT_MESSAGE.reset_system, new Buffer([0])); // Low-power state, terminate all channels
//    //write(reset_msg, errCallback, false, true, 500); // Wait 500ms on reset
//    outEP.write(reset_msg.buffer);
//}, 5000);





//function exitApplication() {
//    //send(ANT_CloseChannel(false, 0), 3, 50, 0,
//    //     function (data) { parse_response(data); return isResponseNoError(data, ANT_MESSAGE.close_channel.id); },
//    //     function () { console.log("Could not close channel 0"); },
//    //     function (data) {
//    //         console.log("Channel 0 closed.");
//    //         antInterface.release(function (error) { console.log("Released interface now closing device"); if (error) console.log("Error:" + error); ant.close(); process.exit(); });
//    //     });

//    self.ANT.exit();
   

//    //setTimeout(
//    //    function () {
//    //        //console.log("Stopping streams...");
//    //        //inEP.stopStream();
//    //        //outEP.stopStream();
//    //        setTimeout(function () {
                
//    //        }, 1000);
//    //    }, 1000);

//}

