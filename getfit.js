#! /usr/bin/env node
"use strict";
//console.log("require.main",require.main);

// Some info. from a python implementation of ANTFS: https://github.com/Tigge/Garmin-Forerunner-610-Extractor

var util = require('util'),
    events = require('events'),
    Channel = require('./node_modules/ant-lib/channel.js'),
    ANT = require('ant-lib'),
   // Channel = require('./node_modules/ant-lib/channel.js'),
    DeviceProfile_ANTFS = require('./node_modules/ant-lib/deviceProfile_ANTFS.js'),
    BackgroundScanningChannel = require('./node_modules/ant-lib/backgroundScanningChannel.js'),
    ContinousScanningChannel = require('./node_modules/ant-lib/ContinousScanningChannel.js'),
    fs = require('fs'),
    getFitProgram = require('commander'),
    // Based on http://nodejs.org/api/modules.html#modules_accessing_the_main_module
    runDirectly = (require.main === module) ? true : false,
    PathSeparator = require('path').sep;

function GetFIT() {

    var self = this;

    self._configuration = {
    };
           
    function list(val) {
        return val.split(',');
    }

    // require.main === module if run directly via "node getfit"
    if (runDirectly) {

        console.log("GetFIT version " + GetFIT.prototype.VERSION, "PID",process.pid,"node version", process.versions.node, "V8", process.versions.v8, "on " + process.platform + " " + process.arch);

        GetFIT.prototype.STARTUP_DIRECTORY = process.argv[1].slice(0, process.argv[1].lastIndexOf(PathSeparator));
        //console.log("process.argv", process.argv);
        console.log(Date.now() + " Process startup directory :", GetFIT.prototype.STARTUP_DIRECTORY);
        
        self._configuration = self.getConfigurationFromFile(GetFIT.prototype.STARTUP_DIRECTORY + PathSeparator+'configuration.json');

        if (typeof self._configuration === "undefined")
            process.exit(GetFIT.prototype.ERROR.CONFIGURATION_NOT_FOUND);

        getFitProgram.version(GetFIT.prototype.VERSION)
           // .option('-n,--new', 'Download FIT files flagged as new')
            .option('-l,--list', 'List directory of ANT-FS device')
            .option('-d,--download <items>', "Download FIT files at index '<n1>,<n2>,...'", list)
            .option('-a,--download-all', 'Download the entire index of FIT files')
            .option('-e,--erase <items>', "Erase FIT file at index '<n1>'", list)
            .option('-b,--background', 'Background search channel for ANT+ devices + websocket server sending ANT+ pages for HRM/SDM4/SPDCAD device profile')
            .option('-c,--continous', 'Continous scan mode for ANT+ devices + websocket server sending ANT+ pages for HRM/SDM4/SPDCAD device profile')
            .parse(process.argv);

        //if (getFitProgram.new)
        //    self._commandQueue.push(DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_NEW);

        if (getFitProgram.list) 
            this.executeANTFSCommand(GetFIT.prototype.ANTFS_COMMAND.DOWNLOAD_MULTIPLE,undefined);
        else
            if (getFitProgram.download) 
                this.executeANTFSCommand(GetFIT.prototype.ANTFS_COMMAND.DOWNLOAD_MULTIPLE,getFitProgram.download);
            else
                if (getFitProgram.downloadAll) 
                    this.executeANTFSCommand(GetFIT.prototype.ANTFS_COMMAND.DOWNLOAD_ALL,undefined);
                else
                    if (getFitProgram.erase) 
                        this.executeANTFSCommand(GetFIT.prototype.ANTFS_COMMAND.ERASE_MULTIPLE,getFitProgram.erase);
                    else
                        if (getFitProgram.background) {
                            this._backgroundScanningChannel = new BackgroundScanningChannel(this.getConfiguration());
                            this._backgroundScanningChannel.initANT(function _cb () {
                                console.log(Date.now(), "Enabling channel for background scanning for ANT+ devices");
                                this.enableChannelConfiguration(this.getSlaveChannelConfiguration({
                                    "networkNr": 0,
                                    "channelNr": 0,
                                    "deviceNr": Channel.prototype.CHANNELID.DEVICE_NUMBER_WILDCARD,
                                    "deviceType": Channel.prototype.CHANNELID.DEVICE_TYPE_WILDCARD,
                                    "transmissionType": Channel.prototype.CHANNELID.TRANSMISSION_TYPE_WILDCARD,
                                    "searchTimeoutHP": ANT.prototype.SEARCH_TIMEOUT.DISABLE_HIGH_PRIORITY_SEARCH_MODE,
                                    "searchTimeoutLP" :  ANT.prototype.SEARCH_TIMEOUT.INFINITE_SEARCH
                                }));
                            }.bind(this._backgroundScanningChannel));
                        }
                        else
                            if (getFitProgram.continous) {
                                console.log(Date.now(), "Using continous scan mode for ANT+ devices");
                                this.setScanningChannel("continous");
                            }
                            else // Default to enabling ANT_FS device profile 
                                this.executeANTFSCommand(undefined,undefined);
    }

}

GetFIT.prototype = {

    ANTFS_COMMAND : {
        "DOWNLOAD_MULTIPLE" : DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_MULTIPLE,
        "DOWNLOAD_ALL" : DeviceProfile_ANTFS.prototype.NODECOMMAND.DOWNLOAD_ALL,
        "ERASE_MULTIPLE" : DeviceProfile_ANTFS.prototype.NODECOMMAND.ERASE_MULTIPLE
    },

        ERROR : {
            "CONFIGURATION_NOT_FOUND" : 0x01
        },

    VERSION: "0.1.0",

    DEFAULT_WEBSOCKET_HOST: 'localhost',
    DEFAULT_WEBSOCKET_PORT: 8093,

    executeANTFSCommand : function (command,index)
    {
        
        this.ANTFS_profile = new DeviceProfile_ANTFS(this.getConfiguration());
        var self = this.ANTFS_profile;
        if (typeof command !== "undefined")
            this.ANTFS_profile.addCommand(command);
        if (typeof index !== "undefined") {
            this.ANTFS_profile.addIndex(index);
        }
        this.ANTFS_profile.initANT(function _cb () {
            console.log(Date.now(), "Enabling channel for ANT_FS client");
            self.enableChannelConfiguration(self.getSlaveChannelConfiguration({
                "networkNr": 0,
                "channelNr": 0,
                // Timeout : Math.round(60 / 2.5)
                "deviceNr": Channel.prototype.CHANNELID.DEVICE_NUMBER_WILDCARD,
                "deviceType": Channel.prototype.CHANNELID.DEVICE_TYPE_WILDCARD,
                "transmissionType": Channel.prototype.CHANNELID.TRANSMISSION_TYPE_WILDCARD,
                "searchTimeoutHP": ANT.prototype.SEARCH_TIMEOUT.INFINITE_SEARCH
            }));
        });
    },

    getConfiguration : function ()
    {
        return this._configuration;
    },

    

    verifyConfiguration : function ()
    {
        if (typeof this._configuration === "undefined")
            this._configuration = {};

    },

    setNetworkKey : function (name,key)
    {
        this.verifyConfiguration();
        if (typeof this._configuration.network_keys === "undefined")
            this._configuration.network_keys = {};

        this._configuration.network_keys[name] = key;
    },

    setUSBDevice : function (name,idVendor,idProduct)
    {
        this.verifyConfiguration();
        if (typeof this._configuration.usb === "undefined")
            this._configuration.usb = {};

        this._configuration.usb.name = name;
        this._configuration.usb.idVendor = idVendor;
        this._configuration.usb.idProduct = idProduct;
    },

    setWebsocketServer : function (host,port)
    {
        this.verifyConfiguration();
        if (typeof this._configuration.websocket === "undefined")
            this._configuration.websocket = {};

        this._configuration.websocket.host = host;
        this._configuration.websocket.port = port;
    },


    setConfiguration : function (configuration)
    {
        this._configuration = configuration;
    },

    getConfigurationFromFile : function (configurationFileName)
    {
        if (fs.existsSync(configurationFileName)) {
            return JSON.parse(fs.readFileSync(configurationFileName));
        } else {
            console.log("Did not find configuration filename ", configurationFileName);
            return undefined;
        }
    },

   

    getWebSocketServer : function ()
    {
        return self.wss;
    },
    
    // Broadcast data to all clients
    broadCastOnWebSocket:  function (data) {
         var self = this;

         //console.log(self.wss);

         if (typeof self.wss === "undefined") {
             console.warn(Date.now()+" WEBSOCKET: no websocket server available on "+self._configuration.websocket.host+":"+self._configuration.websocket.port," broadcast failed ", data);
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

    //stop: function () {
    //    var self = this;

    //    clearInterval(self.heartBeatIntervalID);

    //    if (typeof self.wss !== "undefined") {
    //        console.log(Date.now()+ " Closing websocket server");
    //        self.wss.close();
    //    }

    //    if (typeof self._configuration.deviceProfile !== "undefined") {
    //        self._configuration.deviceProfile.stop();
    //    } else
    //        console.warn(Date.now(),"Found no device profile attached to configuration, unable to stop USB ANT device gracefully"); 
    //},

   

    //start: function () {
    //    // console.log(process);
    //    //var self = this,
    //    //    scanningChannel,
    //    //    heartBeat = 0,
    //    //    beatFunc = function ()
    //    //    {
    //    //        heartBeat++;
    //    //    };

    //    ////console.log("Configuration object", self._configuration);

    //    ////self.heartBeat = 0;
    //    //self.heartBeatIntervalID = setInterval(beatFunc, 60000 * 60 * 24); // 1 "beat" each day 

    //    //// Handle gracefull termination
    //    //// http://thomashunter.name/blog/gracefully-kill-node-js-app-from-ctrl-c/

    //    //process.on('SIGINT', function sigint() {
    //    //    console.log(Date.now() + " Process interrupted - signal SIGINT (Ctrl+C)");

    //    //    // TO DO:  self.deviceProfile_ANTFS.sendDisconnect.call(self); // Disconnect

    //    //    self.stop();

    //    //});

    //    // Lesson : ANT-FS and HRM on different network due to different keys
    //    // Seems like : Cannot simultaneously listen to broadcasts from ANT-FS =  2450 MHz and HRM/Bike spd/Stride sensor = 2457 Mhz, but with different msg. periode

       

    //    if (self._configuration.scanningChannel === "continous") {
    //        console.log(Date.now(), "Setting channel configuration for continous channel");
    //        scanningChannel = new ContinousScanningChannel(this);
          
    //        self.ANT.setChannelConfiguration(0, scanningChannel.getSlaveChannelConfiguration(0, 0,
    //            Channel.prototype.CHANNELID.DEVICE_NUMBER_WILDCARD, Channel.prototype.CHANNELID.DEVICE_TYPE_WILDCARD, Channel.prototype.CHANNELID.TRANSMISSION_TYPE_WILDCARD,
    //            ANT.prototype.SEARCH_TIMEOUT.INFINITE_SEARCH, ANT.prototype.ANT_FREQUENCY, new Buffer(self._configuration.network_keys.ANT_PLUS)));
    //        self.ANT.activateChannelConfiguration(0, function error(err) { console.log("Could not configure continous scanning channel ANT+ ", err); },
    //                        function successCB(data) {
    //                            openChannel();
    //                        });
    //        this.startWebSocketServer();
    //    } else
    //        if (self._configuration.scanningChannel === "background") {
    //            console.log(Date.now(), "Setting channel configuration for background channel");
    //            scanningChannel = new BackgroundScanningChannel(this);
    //            self.ANT.setChannelConfiguration(0, scanningChannel.getSlaveChannelConfiguration(0, 0,
    //                Channel.prototype.CHANNELID.DEVICE_NUMBER_WILDCARD, 
    //              Channel.prototype.CHANNELID.DEVICE_TYPE_WILDCARD, 
    //              Channel.prototype.CHANNELID.TRANSMISSION_TYPE_WILDCARD,
    //                ANT.prototype.SEARCH_TIMEOUT.INFINITE_SEARCH, ANT.prototype.ANT_FREQUENCY, new Buffer(self._configuration.network_keys.ANT_PLUS)));
    //            console.log(self.ANT.channelConfiguration);
    //            self.ANT.activateChannelConfiguration(0, function error(err) { console.log("Could not configure background scanning channel ANT+ ", err); },
    //           function successCB(data) {
    //               openChannel();
    //           });
    //            this.startWebSocketServer();
    //        } else {
              
    //        }
        

    //},

    startWebSocketServer: function () {
        var self = this;

        if (typeof self._configuration.websocket === "undefined") {
            console.warn(Date.now(), "No websocket configuration specified, will not broadcast sensor data on websocket");
            return;
        } else if (typeof self._configuration.websocket.host === "undefined") {
            console.warn(Date.now(), "No websocket host, default host "+GetFIT.prototype.DEFAULT_WEBSOCKET_HOST +" used");
            self._configuration.websocket.host = GetFIT.prototype.DEFAULT_WEBSOCKET_HOST;
          
        } else if (typeof self._configuration.websocket.port === "undefined") {
            console.warn(Date.now(), "No websocket port specifiedn, default port "+ GetFIT.prototype.DEFAULT_WEBSOCKET_PORT+" used");
            self._configuration.websocket.port = GetFIT.prototype.DEFAULT_WEBSOCKET_PORT;
        }
        // Start websocket server

        var WebSocketServer = require('ws').Server;
        if (typeof WebSocketServer === "undefined") {
            console.error(Date.now() + " Failed to load websocket module - ws");
            return;
        }

        // Client tracking keeps track of websocket server clients in "clients" property -> removed on 'close'
        self.wss = new WebSocketServer({ host: self._configuration.websocket.host, port: self._configuration.websocket.port, clientTracking: true });

        self.wss.on('listening', function () {
            console.log(Date.now() + " Live streaming sensor ANT+ pages - WebSocketServer: listening on " + self._configuration.websocket.host + ":" + self._configuration.websocket.port+" for clients");
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

module.exports = new GetFIT();