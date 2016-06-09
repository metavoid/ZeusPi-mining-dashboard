var express = require('express');
var app = express();

var respawn = require('respawn');
var fs = require('fs');
var execSync = require('child_process').execSync;

//Init local variables

var stats = {};
var config = {};
var pools = [];


//BFGMiner init

var bfgminer = {};

//Miner constructor with respawn

function minerSetup(miner, config) {
    if (miner.stop) miner.stop();

    miner = respawn(['/home/pi/bfgminer/bfgminer', '--scrypt', '-o', config.pool, '-u', config.login, '-p', config.pass, '--zeus-cc', config.chips, '--zeus-clk', config.clock, '-S zeus:all'], {
        cwd: '.', // set cwd
        maxRestarts: 20, // how many restarts are allowed within 60s
        // or -1 for infinite restarts
        sleep: 200, // time to sleep between restarts,
        kill: 3000, // wait 3s before force killing after stopping

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

///Get sys temperature

app.get('/api/getTemp', function(req, res) {
    res.send({temp: getSysTemp()});
  
});

//Miner handlers

function startMiner(miner) {
    miner.start();
}

function stopMiner(miner) {
    miner.stop();
}

function restartMiner(miner) {
    miner.stop(function() {
        miner.start()
    })
}

function resetMiner() {
    bfgminer = minerSetup(bfgminer, config);
    //startMiner(bfgminer);

}

//Stats helpers

function getSysTemp() {

    var temp = parseFloat(execSync('cat /sys/class/thermal/thermal_zone0/temp')) / 1000;

    return temp;

}

//Miner stdout parser

function parseOutput(data) {
    console.log('DATA CHUNK: ' + data + '///END');
}

//Stats handlers

function dropStats() {
    stats = {
        hashrate: 0,
        accepted: 0,
        rejected: 0,
        hw: 0,
        alive: false
    }
}

//Config and pool list loaders

function loadConfig() {

    config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
}

function loadPoolList() {
    pools = JSON.parse(fs.readFileSync('pool-list.json', 'utf-8')).pools;
}

//Main init

function init() {
    dropStats();
    loadConfig();
    loadPoolList();
    resetMiner();


}

init();