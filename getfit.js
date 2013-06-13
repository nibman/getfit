"use strict";

// Some info. from a python implementation of ANTFS: https://github.com/Tigge/Garmin-Forerunner-610-Extractor

var
    //fs = require('fs'),
    util = require('util'),
    events = require('events'),
    ANT = require('./ant-lib'),
    DeviceProfile_HRM = require('./deviceProfile_HRM.js'),
    DeviceProfile_SDM = require('./deviceProfile_SDM.js'),
    DeviceProfile_ANTFS = require('./deviceProfile_ANTFS.js'),
    DeviceProfile_SPDCAD = require('./deviceProfile_SPDCAD.js'),
    Network = require('./network.js');

function GetFIT() {

    console.log("GetFIT version ", GetFIT.prototype.VERSION);

    var self = this;
    self.commandQueue = [];
    self.commandIndex = [];

    //if (process.argv.length <= 2) {
    //    showUsage();
    //    return;
    //}

    function parseIndex(indexArg) {

        var parsed = indexArg.split(',').map(function (value, index, arr) {
            var range = value.split('-'), low, high, newarr = [], v;
            if (range.length === 2) {
                low = parseInt(range[0],10);
                high = parseInt(range[1], 10);

                if (low < high)
                    for (var nr = low; nr <= high; nr++)
                        newarr.push(nr);

                return newarr;
            } else

                v = parseInt(value, 10); if (!isNaN(v)) return v;
        }),
        elementNr, rangeArr, rangeElementNr, indexArr = [] ;

        console.log("Parsed", parsed);

        for (elementNr = 0; elementNr < parsed.length; elementNr++)
            if (typeof parsed[elementNr] === 'object') // Process range
            {
                rangeArr = parsed[elementNr];
                for (rangeElementNr = 0; rangeElementNr < rangeArr.length; rangeElementNr++)
                    if (typeof rangeArr[rangeElementNr] === 'number')
                        indexArr.push(rangeArr[rangeElementNr]);
            }
            else if (typeof parsed[elementNr] === 'number')
                indexArr.push(parsed[elementNr]);

        console.log("Index arr",indexArr);

        return indexArr;
    }

    GetFIT.prototype.STARTUP_DIRECTORY = process.argv[1].slice(0, process.argv[1].lastIndexOf('\\'));
    console.log(Date.now()+ " Process startup directory :", GetFIT.prototype.STARTUP_DIRECTORY);

   // console.log("argv", process.argv);

    if (process.argv[2] === "-d" || process.argv[2] === "--download") {
        if (typeof process.argv[3] === "undefined")
            self.commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_NEW);
        else if (process.argv[3] === "*")
            self.commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_ALL);
        else {
            self.commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_MULTIPLE); // i.e '1,2,3'
            //argNr = 3;
            self.commandIndex.push(parseIndex(process.argv[3]));
        }


    } else if (process.argv[2] === "-e" || process.argv[2] === "--erase") {
        self.commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.ERASE_MULTIPLE);
        if (typeof process.argv[3] === "undefined") {
            console.log("Missing file index/range");
            showUsage();
            return;
        } else
            self.commandIndex.push(parseIndex(process.argv[3]));

    }
    //else {
    //    showUsage();
    //    return;
    //}

    function showUsage() {
        console.log("Commands :");
        console.log("   -d, --download - download new files from device");
        console.log("   -d n - download file at index n");
        console.log("   -d 'n1,n2,n3-n4' -download file at index n1 and n2 and n3 to n4");
        console.log("   -d * - download all readable files");
        console.log("   -e, --erase  n1 - erase file at index n1");
    }

    // var idVendor = 4047, idProduct = 4104; // Garmin USB2 Wireless ANT+
    this.ANT = new ANT(4047, 4104,this);

    this.deviceProfile_HRM = new DeviceProfile_HRM(this);
    this.deviceProfile_SDM = new DeviceProfile_SDM(this);
    this.deviceProfile_ANTFS = new DeviceProfile_ANTFS(this);
    this.deviceProfile_SPDCAD = new DeviceProfile_SPDCAD(this);

    function successCB() {
        self.start();
    }

    function errorCB() {
        self.stop();
    }

    self.ANT.init(errorCB, successCB);
}

GetFIT.prototype = {

    VERSION: "0.1",

    WEBSOCKET_HOST: 'localhost',
    WEBSOCKET_PORT: 8093,
    
    // Broadcast data to all clients
    broadCast:  function (data) {
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

        if (typeof self.wss !== "undefined") {
            console.log(Date.now()+ " Closing websocket server");
            self.wss.close();
        }

        self.ANT.exit();
    },

    beat: function ()  // When we have nothing more important to do ...
    {
        var self = this;
        self.heartBeat++;
    },

    start: function () {
       // console.log(process);
        var self = this;

        self.heartBeat = 0;
        self.heartBeatIntervalID = setInterval(self.beat, 60000 * 60 * 24); // 1 "beat" each day 

        // Handle gracefull termination
        // http://thomashunter.name/blog/gracefully-kill-node-js-app-from-ctrl-c/

        process.on('SIGINT', function sigint() {
             console.log(Date.now()+ " User requested process interruption - signal SIGINT (Ctrl+C)");

            // TO DO:  self.deviceProfile_ANTFS.sendDisconnect.call(self); // Disconnect

            self.stop();

        });

        // Channel configurations indexed by channel nr.

        //self.ANT.setChannelConfiguration(0, self.deviceProfile_HRM.getSlaveChannelConfiguration(Network.prototype.ANT, 0, 0, 0, ANT.prototype.INFINITE_SEARCH));
        self.ANT.setChannelConfiguration(1, self.deviceProfile_ANTFS.getSlaveChannelConfiguration(Network.prototype.ANT_FS, 1, 0, 0, 0, GetFIT.prototype.STARTUP_DIRECTORY));
        //self.ANT.setChannelConfiguration(2,self.deviceProfile_SDM.getSlaveChannelConfiguration(Network.prototype.ANT, 2, 0, 0, ANT.prototype.INFINITE_SEARCH));
        //self.ANT.setChannelConfiguration(3,self.deviceProfile_SPDCAD.getSlaveChannelConfiguration(Network.prototype.ANT, 3, 0, 0, ANT.prototype.INFINITE_SEARCH));

        // Lesson : ANT-FS and HRM on different network due to different keys
        // Seems like : Cannot simultaneously listen to broadcasts from ANT-FS =  2450 MHz and HRM/Bike spd/Stride sensor = 2457 Mhz, but with different msg. periode

        //self.ANT.activateChannelConfiguration(0, function () { console.log("Could not configure device profile HRM"); }, function () {
        //    console.log("Configuration of device profile HRM channel OK");
            self.ANT.activateChannelConfiguration(1, function () { console.log("Could not configure device profile ANT-FS"); }, function () {
        //        console.log("Configuration of device profile ANT-FS OK");
        //        self.ANT.activateChannelConfiguration(3, function () { console.log("Could not configure device profile SPDCAD"); }, function () {
                    //console.log("Configuration of device profile SDM OK");
                    //self.ANT.activateChannelConfiguration(2, function () { console.log("Could not configure device profile SDM"); }, function () {
                        //console.log("Configuration of device profile SDM OK");
                        //self.ANT.open(0, function () { console.log("Could not open channel for HRM"); }, function () {
                        //    console.log("Open channel for HRM");
                        //self.ANT.open(2, function error() { console.log("Could not open channel for SDM"); }, function success() {
                        //     console.log(Date.now()+ " Open channel for SDM");
                        //console.log(self.ANT.channelConfiguration);
                        self.ANT.open(1, function () { console.log("Could not open channel for ANT-FS"); }, function () {
                            //console.log(Date.now() + " ANT-FS channel OPEN");
                            self.ANT.listen.call(self.ANT, function transferCancelCB() {
                                self.ANT.iterateChannelStatus(0, true, function clean() {
                                    self.ANT.tryCleaningBuffers(function release() {
                                        self.ANT.releaseInterfaceCloseDevice();
                                    });
                                });
                            });
                        });
                        //  });
                        //})
                    //});
        //        });
            });
        //});

        
        //this.startWebSocketServer();

    },

    startWebSocketServer: function () {
        var self = this;
        // Start websocket server

        var WebSocketServer = require('ws').Server;

        // Client tracking keeps track of websocket server clients in "clients" property -> removed on 'close'
        self.wss = new WebSocketServer({ host: GetFIT.prototype.WEBSOCKET_HOST, port: GetFIT.prototype.WEBSOCKET_PORT, clientTracking: true });

        self.wss.on('listening', function () {
            console.log(Date.now()+ " WebSocketServer: listening on " + GetFIT.prototype.WEBSOCKET_HOST + ":" + GetFIT.prototype.WEBSOCKET_PORT);
        });

        self.wss.on('connection', function (ws) {
            console.log(Date.now() + " WebSocketServer: New client connected - will receive broadcast data");
            // console.log(ws);
            //self.websockets.push(ws); // Keeps track of all incoming websocket clients

            ws.on('message', function (message) {
                console.log(Date.now() + ' WebSocketServer received: %s', message);
                //    ws.send('something');
            });
        });

        self.wss.on('error', function (error) {
            console.log(Date.now() + "WebSocketServer: Error ", error);
        });
    }

};

var ANTNode = new GetFIT();