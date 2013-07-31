"use strict";

// Some info. from a python implementation of ANTFS: https://github.com/Tigge/Garmin-Forerunner-610-Extractor

var
    //fs = require('fs'),
    util = require('util'),
    events = require('events'),
    ANT = require('ant-lib'),
    Channel = require('./node_modules/ant-lib/channel.js'),
    DeviceProfile_ANTFS = require('./node_modules/ant-lib/deviceProfile_ANTFS.js'),
    BackgroundScanningChannel = require('./node_modules/ant-lib/backgroundScanningChannel.js'),
    ContinousScanningChannel = require('./node_modules/ant-lib/continousScanningChannel.js'),
    fs = require('fs'),
    getFitProgram = require('commander')

function GetFIT() {

    console.log("GetFIT version "+ GetFIT.prototype.VERSION, "node version",process.versions.node,"V8",process.versions.v8,"on "+process.platform+" "+process.arch);

    
    var self = this,
         configurationFileName,
        configurationRaw;

    self.commandQueue = [];
    self.commandIndex = [],

    GetFIT.prototype.STARTUP_DIRECTORY = process.argv[1].slice(0, process.argv[1].lastIndexOf('\\'));
    //console.log(Date.now() + " Process startup directory :", GetFIT.prototype.STARTUP_DIRECTORY);


    // Read configuration

    configurationFileName = GetFIT.prototype.STARTUP_DIRECTORY + '\\configuration.json';
    if (fs.existsSync(configurationFileName)) {
        configurationRaw = fs.readFileSync(configurationFileName);
        //console.log(configurationRaw.toString());
        self.configuration = JSON.parse(configurationRaw);
        //console.log(self.configuration);
    } else {
        console.log("Did not find configuration filename ", configurationFileName);
        process.exit(GetFIT.prototype.ERROR.CONFIGURATION_NOT_FOUND);
    }

    function list(val) {
        return val.split(',');

    }

    getFitProgram.version(GetFIT.prototype.VERSION)
       // .option('-n,--new', 'Download FIT files flagged as new')
        .option('-l,--list','List directory of ANT-FS device')
        .option('-d,--download <items>', "Download FIT files at index '<n1>,<n2>,...'", list)
        .option('-a,--download-all', 'Download the entire index of FIT files')
        .option('-e,--erase',"Erase FIT files at index '<n1>,<n2>,...'",list)
        .option('-b,--background', 'Background search channel for ANT+ devices + websocket server sending ANT+ pages for HRM/SDM4/SPDCAD device profile')
        .option('-c,--continous', 'Continous scan mode for ANT+ devices + websocket server sending ANT+ pages for HRM/SDM4/SPDCAD device profile')
        .parse(process.argv);

    //if (getFitProgram.new)
    //    self.commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_NEW);

    if (getFitProgram.list)
        self.commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_MULTIPLE);

    if (getFitProgram.download) {
        self.commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_MULTIPLE); // i.e '1,2,3'
        self.commandIndex.push(getFitProgram.download);
    }

    if (getFitProgram.downloadAll)
        self.commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_ALL);

    if (getFitProgram.erase) {
        self.commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.ERASE_MULTIPLE);
        self.commandIndex.push(getFitProgram.erase);
    }

    if (getFitProgram.background) {
        console.log(Date.now(), "Using background search channel for ANT+ devices");
        this.configuration.scanningChannel = ANT.prototype.SCANNING_CHANNEL_TYPE.BACKGROUND;
    }

    if (getFitProgram.continous) {
        console.log(Date.now(), "Using continous scan mode for ANT+ devices");
        this.configuration.scanningChannel = ANT.prototype.SCANNING_CHANNEL_TYPE.CONTINOUS;
    }

   

    // var idVendor = 4047, idProduct = 4104; // Garmin USB2 Wireless ANT+
    if (typeof self.configuration.usb === "undefined")
    {
        console.warn(Date.now(),"Found no USB configuration for vendor id. and product id for USB ANT device, setting default Garmin USB2 Wireless ANT+");
        self.configuration.usb = {
            idVendor : 4047,
            idProduct : 4104
        }
    } 
    
    if (typeof self.configuration.usb.idVendor === "undefined")
    {
        console.warn(Date.now(),"Found no vendor id. for USB ANT device, setting default Garmin USB2 Wireless ANT+  = 4047");
        self.configuration.usb.idVendor = 4047;
    }
    
    if (typeof self.configuration.usb.idProduct === "undefined") {
        console.warn(Date.now(), "Found no product id. for USB ANT device, setting default Garmin USB2 Wireless ANT+  = 4104");
        self.configuration.usb.idProduct = 4104;
    }

    this.ANT = new ANT(self.configuration.usb.idVendor, self.configuration.usb.idProduct, this);

    //if (this.useBackgroundScanningChannel)
    //    this.backgroundScanningChannelANT = new BackgroundScanningChannel(this);

    //if (this.useContinousScanningChannel)
    //    this.continousScanningChannelANT = new ContinousScanningChannel(this);

    //this.deviceProfile_HRM = new DeviceProfile_HRM(this);
    //this.deviceProfile_SDM = new DeviceProfile_SDM(this);
    this.deviceProfile_ANTFS = new DeviceProfile_ANTFS(this);
    //this.deviceProfile_SPDCAD = new DeviceProfile_SPDCAD(this);

    function successCB() {
        self.start();
    }

    function errorCB() {
        self.stop();
    }

    self.ANT.init(errorCB, successCB);
}

    GetFIT.prototype = {

        ERROR : {
            "CONFIGURATION_NOT_FOUND" : 0x01
        },

    VERSION: "0.1",

    DEFAULT_WEBSOCKET_HOST: 'localhost',
    DEFAULT_WEBSOCKET_PORT: 8093,

    getWebSocketServer : function ()
    {
        return self.wss;
    },
    
    // Broadcast data to all clients
    broadCastOnWebSocket:  function (data) {
         var self = this;

         //console.log(self.wss);

         if (typeof self.wss === "undefined") {
             console.warn(Date.now()+" WEBSOCKET: no websocket server available on "+self.configuration.websocket.host+":"+self.configuration.websocket.port," broadcast failed ", data);
             return;
         }

         var len = self.wss.clients.length;
         //console.log("Length of clients", len);
         for (var clientNr = 0; clientNr < len; clientNr++) {
             if (typeof self.wss.clients !== "undefined" && self.wss.clients[clientNr] !== "undefined") // Just to make sure we have clientTracking and client is present
             {
                 //console.log("Sending data to client nr. ", clientNr, "data:",data);
                 //console.log(self.wss.clients[clientNr]);
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
        var self = this,
            scanningChannel;

        //console.log("Configuration object", self.configuration);

        self.heartBeat = 0;
        self.heartBeatIntervalID = setInterval(self.beat, 60000 * 60 * 24); // 1 "beat" each day 

        // Handle gracefull termination
        // http://thomashunter.name/blog/gracefully-kill-node-js-app-from-ctrl-c/

        process.on('SIGINT', function sigint() {
            console.log(Date.now() + " Process interrupted - signal SIGINT (Ctrl+C)");

            // TO DO:  self.deviceProfile_ANTFS.sendDisconnect.call(self); // Disconnect

            self.stop();

        });

        // Lesson : ANT-FS and HRM on different network due to different keys
        // Seems like : Cannot simultaneously listen to broadcasts from ANT-FS =  2450 MHz and HRM/Bike spd/Stride sensor = 2457 Mhz, but with different msg. periode

        var openChannel = function () {
            self.ANT.libConfig(ANT.prototype.LIB_CONFIG.ENABLE_RX_TIMESTAMP | ANT.prototype.LIB_CONFIG.ENABLE_RSSI | ANT.prototype.LIB_CONFIG.ENABLE_CHANNEL_ID,
               function errorCB(err) { console.log(Date.now() + " Could not configure ANT for extended info. RX Timestamp/RSSI/ChannelID", err); },
                function successCB() {

                    var listenFunc = function () {
                        //    console.log(Date.now() + " Background scanning channel ANT+ OPEN");
                        self.ANT.listen.call(self.ANT, function transferCancelCB() {
                            self.ANT.iterateChannelStatus(0, true, function clean() {
                                self.ANT.tryCleaningBuffers(function release() {
                                    self.ANT.releaseInterfaceCloseDevice();
                                });
                            });
                        });
                    };

                    //console.trace();

                    if (self.configuration.scanningChannel === ANT.prototype.SCANNING_CHANNEL_TYPE.CONTINOUS)
                        self.ANT.openRxScanMode(0, function (err) { console.log("Could not open Rx Scan Mode channel", err); }, listenFunc);
                    else
                        self.ANT.open(0, function (err) { console.log("Could not open channel", err); }, listenFunc);

                });
        };

        if (self.configuration.scanningChannel === ANT.prototype.SCANNING_CHANNEL_TYPE.CONTINOUS) {
            console.log(Date.now(), "Setting channel configuration for continous channel");
            scanningChannel = new ContinousScanningChannel(this);
          
            self.ANT.setChannelConfiguration(0, scanningChannel.getSlaveChannelConfiguration(0, 0,
                Channel.prototype.CHANNELID.DEVICE_NUMBER_WILDCARD, Channel.prototype.CHANNELID.DEVICE_TYPE_WILDCARD, Channel.prototype.CHANNELID.TRANSMISSION_TYPE_WILDCARD,
                ANT.prototype.SEARCH_TIMEOUT.INFINITE_SEARCH, ANT.prototype.ANT_FREQUENCY, new Buffer(self.configuration.network_keys.ANT_PLUS)));
            self.ANT.activateChannelConfiguration(0, function error(err) { console.log("Could not configure continous scanning channel ANT+ ", err); },
                            function successCB(data) {
                                openChannel();
                            });
            this.startWebSocketServer();
        } else
            if (self.configuration.scanningChannel === ANT.prototype.SCANNING_CHANNEL_TYPE.BACKGROUND) {
                console.log(Date.now(), "Setting channel configuration for background channel");
                scanningChannel = new BackgroundScanningChannel(this);
                self.ANT.setChannelConfiguration(0, scanningChannel.getSlaveChannelConfiguration(0, 0,
                    Channel.prototype.CHANNELID.DEVICE_NUMBER_WILDCARD, Channel.prototype.CHANNELID.DEVICE_TYPE_WILDCARD, Channel.prototype.CHANNELID.TRANSMISSION_TYPE_WILDCARD,
                    ANT.prototype.SEARCH_TIMEOUT.INFINITE_SEARCH, ANT.prototype.ANT_FREQUENCY, new Buffer(self.configuration.network_keys.ANT_PLUS)));
                console.log(self.ANT.channelConfiguration);
                self.ANT.activateChannelConfiguration(0, function error(err) { console.log("Could not configure background scanning channel ANT+ ", err); },
               function successCB(data) {
                   openChannel();
               });
                this.startWebSocketServer();
            } else {
                
                console.log(Date.now(), "Setting channel configuration for ANT_FS channel");
               
                self.ANT.setChannelConfiguration(0, self.deviceProfile_ANTFS.getSlaveChannelConfiguration(0, 0,
                // Timeout : Math.round(60 / 2.5)
                Channel.prototype.CHANNELID.DEVICE_NUMBER_WILDCARD, Channel.prototype.CHANNELID.DEVICE_TYPE_WILDCARD, Channel.prototype.CHANNELID.TRANSMISSION_TYPE_WILDCARD,
                ANT.prototype.SEARCH_TIMEOUT.INFINITE_SEARCH));
                self.ANT.activateChannelConfiguration(0, function error(err) { console.log("Could not configure background scanning for ANT-FS", err); },
               function successCB() {
                   openChannel();
               });
            }
        

    },

    startWebSocketServer: function () {
        var self = this;

        if (typeof self.configuration.websocket === "undefined") {
            console.warn(Date.now(), "No websocket configuration specified in configuration.json, will not broadcast sensor data on websocket");
            return;
        } else if (typeof self.configuration.websocket.host === "undefined") {
            console.warn(Date.now(), "No websocket hostname specified in configuration.json, default hostname "+GetFIT.prototype.DEFAULT_WEBSOCKET_HOST +" used");
            self.configuration.websocket.host = GetFIT.prototype.DEFAULT_WEBSOCKET_HOST;
          
        } else if (typeof self.configuration.websocket.port === "undefined") {
            console.warn(Date.now(), "No websocket port specified in configuration.json, default port "+ GetFIT.prototype.DEFAULT_WEBSOCKET_PORT+" used");
            self.configuration.websocket.port = GetFIT.prototype.DEFAULT_WEBSOCKET_PORT;
        }
        // Start websocket server

        var WebSocketServer = require('ws').Server;
        if (typeof WebSocketServer === "undefined") {
            console.error(Date.now() + " Failed to load websocket module - ws");
            return;
        }

        // Client tracking keeps track of websocket server clients in "clients" property -> removed on 'close'
        self.wss = new WebSocketServer({ host: self.configuration.websocket.host, port: self.configuration.websocket.port, clientTracking: true });

        self.wss.on('listening', function () {
            console.log(Date.now() + " Live streaming sensor ANT+ pages - WebSocketServer: listening on " + self.configuration.websocket.host + ":" + self.configuration.websocket.port+" for clients");
        });

        self.wss.on('connection', function (ws) {
            console.log(Date.now()," Live streaming sensor ANT+ pages - WebSocketServer: New client connected - will receive broadcast data at "+ws.upgradeReq.headers.origin,ws.upgradeReq.url);
            // console.log(ws);
            //self.websockets.push(ws); // Keeps track of all incoming websocket clients

            ws.on('message', function (message) {
                console.log(Date.now() + ' WebSocketServer received: %s', message);
                //    ws.send('something');
            });
        });

        self.wss.on('error', function (error) {
            console.log(Date.now() + " WebSocketServer: Error ", error);
        });
    }

};

var ANTNode = new GetFIT();