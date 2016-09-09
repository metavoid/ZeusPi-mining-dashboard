var express = require('express');
var app = express();

var respawn = require('respawn');
var fs = require('fs');
var execSync = require('child_process').execSync;
var ping = require("net-ping");
var dns = require('dns');
var urlParser = require('url');
var winston = require('winston');

//Init logger

winston.add(winston.transports.File, {
    filename: '/home/pi/log.txt'
});
winston.remove(winston.transports.Console);



//Init local variables

var stats = {};
var config = {};
var pools = [];


//BFGMiner init

var bfgminer = {};

//Miner constructor with respawn

function minerSetup(miner, config) {
    if (miner.stop) miner.stop();

    console.log(config.activePool+1, pools, pools.length);



    if (pools && pools.length && config.activePool != -1) {
        var poolId = parseInt(config.activePool);
        var pool = pools[poolId].pool;
        var pass = pools[poolId].pass;
        var login = pools[poolId].login;

       var failover1 = '';
        var failover2 = '';
 
        if (poolId > 0 && poolId < pools.length - 1) {
            failover1 = ' -o ' + pools[poolId - 1].pool + ' -u ' + pools[poolId - 1].login + ' -p ' + pools[poolId - 1].pass;
            failover2 = ' -o ' + pools[poolId + 1].pool + ' -u ' + pools[poolId + 1].login + ' -p ' + pools[poolId + 1].pass;
        } else if (poolId == pools.length - 1 && pools.length > 2) {
            failover1 = ' -o ' + pools[poolId - 1].pool + ' -u ' + pools[poolId - 1].login + ' -p ' + pools[poolId - 1].pass;
            failover2 = ' -o ' + pools[poolId - 2].pool + ' -u ' + pools[poolId - 2].login + ' -p ' + pools[poolId - 2].pass;

        } else if (poolId == 0 && pools.length > 2) {
            failover1 = ' -o ' + pools[poolId + 1].pool + ' -u ' + pools[poolId + 1].login + ' -p ' + pools[poolId + 1].pass;
            failover2 = ' -o ' + pools[poolId + 2].pool + ' -u ' + pools[poolId + 2].login + ' -p ' + pools[poolId + 2].pass;

        } 
    }
    console.log(pool, login, pass, failover1, failover2);

    miner = respawn(['/home/pi/zeusPi/bfg_start.sh', '--scrypt', '-o', pool, '-u', login, '-p', pass, failover1, failover2,'--zeus-cc', config.chips, '--zeus-clk', config.clock, '-S zeus:all', '--verbose'], {
        cwd: '.', // set cwd
        maxRestarts: 20, // how many restarts are allowed within 60s
        // or -1 for infinite restarts
        sleep: 200, // time to sleep between restarts,
        kill: 3000,
        uid: 0

    });

    miner.on('stdout', data => parseOutput(data));

    miner.on('stderr', err => parseOutput(err));

    return miner;

}






// Main server init

app.use('/', express.static('public'));


app.listen(80, function() {
    console.log('Listening on port 80...');
});

//Restful API

app.get('/api/startMiner', function(req, res) {
    startMiner(bfgminer);
    res.send("OK");
});

app.get('/api/stopMiner', function(req, res) {
    stopMiner(bfgminer);
    dropStats();
    res.send("OK");
});

app.get('/api/restartMiner', function(req, res) {
    restartMiner(bfgminer);
    res.send("OK");
});

app.get('/api/resetMiner', function(req, res) {
    resetMiner(bfgminer);
    res.send("OK");
});

// Getting stats, config and pools

app.get('/api/getStats', function(req, res) {
    res.send(stats);
});

app.get('/api/getConfig', function(req, res) {
    res.send(config);
});

app.get('/api/getPools', function(req, res) {
    res.send(pools);
});

app.get('/api/dropStats', function(req, res) {
    dropStats();
    res.send("OK");
});

app.get('/api/reboot', function(req, res) {
    reboot();
    res.send("OK");
});

app.get('/api/loadDefaults', function(req, res) {
    toDefaults();
    res.send("OK");
});


//Setting pool and conf

app.get('/api/setActivePool/*', function(req, res) {
    var url_parts = urlParser.parse(req.url, true);
    var query = url_parts.query;

    var poolNum = query.pool;


    config.activePool = poolNum;
    saveConfig();

    resetMiner();

    res.send('OK');

});

app.get('/api/getActivePool', function(req, res) {
    res.send({
        "num": config.activePool
    });
});

app.get('/api/setConf/*', function(req, res) {
    var url_parts = urlParser.parse(req.url, true);
    var query = url_parts.query;

    var chips = query.chips;
    var clock = query.clock;



    config.chips = chips;
    config.clock = clock;

    resetMiner();
    saveConfig();

    res.send('OK');

});

app.post('/api/savePools', function(req, res) {
    req.on('data', function(data) {
        var newPools = JSON.parse(data.toString());
        pools = newPools.pools;
        savePools();

    })

});

///Get sys temperature

app.get('/api/getTemp', function(req, res) {
    res.send({
        temp: getSysTemp()
    });

});

//Ping api
app.get('/api/pingUrl/*', function(req, res) {
    var url_parts = urlParser.parse(req.url, true);
    var query = url_parts.query;

    pingUrl(query.url, res);
});

//Miner handlers

function startMiner(miner) {
    miner.start();
}

function stopMiner(miner) {

    miner.stop();

}

function restartMiner(miner) {
    dropStats();
    miner.stop(function() {
        miner.start()
    })
}

function resetMiner() {

    bfgminer = minerSetup(bfgminer, config);
    dropStats();
    console.log(pools);
    console.log(config);

    startMiner(bfgminer);

}

function reboot() {
    execSync('sudo shutdown -r now');
}

function toDefaults() {
    dropStats();
    config = {

        "activePool": -1,
        "chips": 128,
        "clock": 328

    }

    saveConfig();

    pools = {
        "pools": []
    }

    savePools();
}

//Stats helpers

function getSysTemp() {

    var temp = parseFloat(execSync('cat /sys/class/thermal/thermal_zone0/temp')) / 1000;

    return temp;

}

//Miner stdout parser

function parseOutput(data) {
    data += '';
    console.log(data);
    // winston.log('info', data);
    /* if (~data.indexOf('] New block: ...')) {
        stats.blocks++;
        console.log('\n \n Blocks found: ' + stats.blocks + '\n\n')
    } */

    if (~data.indexOf('failure, disabling!')) {
        restartMiner(bfgminer);
        setTimeout(function(restartMiner, bfg) {
            restartMiner(bfg);
        }, 5000, restartMiner, bfgminer);
    }

    if (data.search(/avg:/i) != -1 && data.search(/20s:/i) != -1) {
        //console.log(data);
        var output = data.split('|');


        var hashrateOut = output[0].substr(output[0].indexOf('20s:') + 4, 5);



        var acceptedOut = output[1].slice(output[1].indexOf('A:') + 2, output[1].indexOf('R:') - 1);
        var rejectedOut = output[1].slice(output[1].indexOf('R:') + 2, output[1].indexOf('+'));
        var hwOut = output[1].slice(output[1].indexOf('HW:') + 3, output[1].indexOf('/'));

        console.log('hashrate: ' + hashrateOut);
        console.log('accepted: ' + acceptedOut);
        console.log('rejected: ' + rejectedOut);
        console.log('hw: ' + hwOut);

        updateStats(hashrateOut, acceptedOut, rejectedOut, hwOut);

    }
}

function updateStats(hash, acc, rej, hw) {

    hash = parseFloat(hash);
    acc = parseInt(acc);
    rej = parseInt(rej);
    hw = parseInt(hw);

    if (typeof hash == 'number' && typeof acc == 'number' && typeof rej == 'number' && typeof hw == 'number') {
        console.log('Stats valid');
        stats.accepted = acc;
        stats.hashrate = hash;
        stats.hw = hw;
        stats.rejected = rej;
    }
}

//Stats handlers

function dropStats() {
    stats = {
        hashrate: 0,
        accepted: 0,
        rejected: 0,
        hw: 0,
        blocks: 0

    }
}

//Config and pool list loaders

function loadConfig() {

    config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
}

function loadPoolList() {
    pools = JSON.parse(fs.readFileSync('pool-list.json', 'utf-8')).pools;
}

function saveConfig() {
    fs.writeFileSync('config.json', JSON.stringify(config), 'utf-8');
}

function savePools() {
    fs.writeFileSync('pool-list.json', JSON.stringify({
        "pools": pools
    }), 'utf-8');
}

//Ping pool helper

function pingUrl(url, response) {
    var session = ping.createSession();
    dns.lookup(url, (err, addr, family) => {

        if (err) {

            response.send({
                "time": -1
            });
        } else {


            session.pingHost(addr, function(error, target, sent, rcvd) {
                var ms = rcvd - sent;
                if (error) {
                    console.log(target + ": " + error.toString());
                    response.send({
                        "time": -1
                    });
                } else {
                    console.log(target + ": Alive (ms=" + ms + ")");
                    response.send({
                        "time": ms
                    });
                }

                session.close();
            });

        }
    });





}

//Main init

function init() {
    dropStats();
    loadConfig();
    loadPoolList();
    resetMiner();


}

init();