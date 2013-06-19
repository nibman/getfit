var fs = require('fs');

function Network(nr, key, startupDirectory) {
    var self = this, fName;
    this.number = nr;
    if (typeof key === "string") // Filename
    {
        fName = startupDirectory+'\\'+key;
        this.key = this.getNetworkKey(key,fName);
    }
    else
        this.key = key;
    //if (fName)
    //    console.log("Network key :", this.key, "from file " + fName,"on network",this.number);
    //else
    //    console.log("Network key : ", this.key, " on network",this.number);
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
