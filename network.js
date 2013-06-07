var fs = require('fs');

function Network(nr, key, startupDirectory) {
    var self = this;
    this.number = nr;
    if (typeof key === "string") // Filename
        this.key = this.getNetworkKey(key,startupDirectory+'\\'+key);
    else
        this.key = key;
}

Network.prototype = {
    NETWORK_KEY: {
        ANTFS: "ANT-FS.BIN",
        ANT: "ANT-PLUS.BIN" // ANT+ managed network key filename , i.e HRM device profile 
    },
    ANT: 0,      // Separate networks due to different keys
    ANT_FS: 1,

    getNetworkKey: function (fullFileName,fileName, completeCB) {
        //fs.readFile(DeviceProfile_ANTFS.prototype.ROOT_DIR + '\\'+fileName, function (err, networkKey) {
        //    if (err) throw err;

        //    if (typeof completeCB === "function")
        //        completeCB(networkKey);
        //    else
        //        console.log(Date.now() + " No completion callback specified");
        //});
        // Only 8 bytes -> sync operation
        //var fullFileName = Node.prototype.STARTUP_DIRECTORY + '\\' + fileName;

        if (typeof Network.prototype.keyCache === "undefined")
            Network.prototype.keyCache = {};

        if (typeof Network.prototype.keyCache[fileName] === "undefined") {
            //console.log("Getting key from file ", fullFileName);
            Network.prototype.keyCache[fileName] = fs.readFileSync(fullFileName);
        }
        //else
        //    console.log("Fetcing key from keycache filename:", fileName, " cached key", Network.prototype.keyCache[fileName]);

        return Network.prototype.keyCache[fileName];
    }
};

module.exports = Network;
