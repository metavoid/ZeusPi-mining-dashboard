(function() {
    //Offcanvas menu handlers

    var menuToggle = document.querySelector('.hamburger');

    menuToggle.addEventListener('click', function(e) {
        e.preventDefault();
        menuToggle.classList.toggle('is-active');
    });

    $(document).ready(function() {
        $('.menu-link').bigSlide();
    });

    //Miner select heandler

    $('.settings__select').on('change', function(event) {
        var chipsCount = event.target.options[event.target.options.selectedIndex].getAttribute('data-chips');

        document.querySelector('.settings__chips').value = chipsCount;
    });



})();

(function() {
    //Pool list logic

    var PoolList = {};
 

    PoolList.list = []
    PoolList.pings = [];

    PoolList.init = function(query) {
        this.listElement = document.querySelector(query);

    }

    PoolList.add = function(url, login, pass) {
        var pool = {
            "login": login,
            "pass": pass,
            "pool": url
        }

        this.list.push(pool);
        this.render();
    }

    PoolList.remove = function(index) {
        this.list.splice(index, 1);

        this.render();
    }

    PoolList.edit = function(index, url, login, pass) {
        var pool = {
            "login": login,
            "pass": pass,
            "pool": url
        }

        this.list[index] = pool;

        this.render();
    }

    PoolList.removeAll = function() {
        this.list = [];
        this.pings = [];
        this.render();

    }

    PoolList.update = function(list) {
        this.list = list;
        this.render();

    }

    PoolList.refreshPing = function() {
        var pings = [];
        this.list.forEach(function(element, index) {
            pingUrl(element.pool, function(ping) {
                pings.unshift(ping);
                if (index == PoolList.list.length-1) {
                    PoolList.pings = pings;
                    console.log(pings.toString());
                }
            });
        });
    }

    PoolList.render = function() {
        var elem = this.listElement;
        var newContent = '<li class="pool-list__title"><span>№</span><span>Url</span><span>Username</span><span>Password</span><span>Ping</span><span>Selected</span><span></span><span></span></li>';

        for (var i = 0; i < this.list.length; i++) {

            var listNode = '<li>';
            listNode += '<span class="pool-list__num">' + i + '</span>';
            listNode += '<span class="pool-list__url">' + this.list[i].pool + "</span>";
            listNode += '<span class="pool-list__username">' + this.list[i].login + "</span>";
            listNode += '<span class="pool-list__password">' + this.list[i].pass + "</span>";
            listNode += '<span class="pool-list__ping">' + (this.pings[i] ? this.pings[i] + ' ms' : '--') + "</span>";
            listNode += '<span class="pool-list__active"><i></i></span><span><i class="pool-list__edit-btn"></i></span><span><div class="pool-list__enable-btn button-material">Select</div></span></li>';

            newContent += listNode;
        }

        elem.innerHTML = newContent;

        $$('.pool-list__enable-btn').forEach(function(element, index) {
            element.addEventListener("click", selectPoolHandler);
        });

        $$('.pool-list__edit-btn').forEach(function(element, index) {
            element.addEventListener("click", editPoolHandler);
        });

        getConf();






    }

    //Main sync code

    PoolList.init('.pool-list');

    //Buttons events 

    $$$('.add-new-pool').addEventListener("click", addPoolHandler);

    $$$('.refresh-ping').addEventListener("click", function() {

        PoolList.render();
        PoolList.refreshPing();


    });

    $$$('.remove-all-pools').addEventListener("click", function() {

        if (confirm('Remove all pools?')) {
            PoolList.removeAll();
            PoolList.render();

            savePools();
            changePool(-1);

        }
    });

    $('.start-miner-btn').on('click', function() {
        startMiner();
    });

    $('.stop-miner-btn').on('click', function() {
        stopMiner();
    });

    $('.restart-miner-ctrl').on('click', function() {
        restartMiner();
    });

    $('.reboot-ctrl').on('click', function(e) {
    	e.preventDefault();
        if(confirm('Reboot device?')) reboot();
    });

    $('.drop-settings-ctrl').on('click', function(e) {
    	e.preventDefault();
        if(confirm('Return to factory defaults?')) dropSettings();
    });

    $('.save-conf-btn').on('click', function() {
        if (confirm('Restart miner with new settings?')) {
            var chips = document.querySelector('.settings__chips').value;
            var clk = document.querySelector('.settings__clock').value;
        }
        changeConf(chips, clk);
    });


    //


    getPools();
    getConf();

    //Stats updater 

    function updateStats() {
        getStats(function(stats) {
            var statsPanel = document.querySelector('.stats');
            statsPanel.querySelector('.hashrate .stats-panel-data').innerHTML = stats.hashrate;
            statsPanel.querySelector('.accepted .stats-panel-data').innerHTML = stats.accepted;
            statsPanel.querySelector('.rejected .stats-panel-data').innerHTML = stats.rejected;
            statsPanel.querySelector('.errors .stats-panel-data').innerHTML = stats.hw;

        });

        updateTemp();

        setTimeout(updateStats, 1500);
    }

    function updateTemp() {
        tinyxhr('/api/getTemp', function(err, data) {

            var temp = JSON.parse(data).temp;
            document.querySelector('.temperature .stats-panel-data').innerHTML = Math.round(temp * 100) / 100;

        }, 'GET');
    }

    updateStats();

    //Event handlers

    function addPoolHandler(e) {
        PoolList.refreshPing();
        clearEditModal();
        invokeEditModal();

        $('.edit-modal__save').off('click');
        $('.edit-modal__delete').off('click');

        $('.edit-modal__save').on('click', function(event) {

            var form = event.target.parentNode.parentNode;

            var url = form.querySelector('.edit-modal__url').value;
            var login = form.querySelector('.edit-modal__login').value;
            var pass = form.querySelector('.edit-modal__password').value;

            if (!!url && !!login && !!pass) {

                PoolList.add(url, login, pass);
                savePools();
                $.modal.close();
                $('.edit-modal__save').off('click');
                $('.edit-modal__delete').off('click');
            }



        });

        $('.edit-modal__delete').on('click', function(event) {
            $.modal.close();
            clearEditModal();
        });

    }

    function selectPoolHandler(e) {
        PoolList.refreshPing();
        if (confirm('Restart miner to this pool?')) {
            var parent = e.target.parentElement.parentElement;
            var num = parent.firstChild.innerHTML;

            changePool(num);
        }
    }

    function editPoolHandler(e) {
        PoolList.refreshPing();
        var parent = e.target.parentElement.parentElement;
        var num = parent.firstChild.innerHTML;

        clearEditModal();

        var currentPool = PoolList.list[num];

        setEditModalData(currentPool.pool, currentPool.login, currentPool.pass);

        $('.edit-modal__save').off('click');
        $('.edit-modal__delete').off('click');

        $('.edit-modal__save').on('click', function(event) {

            var form = event.target.parentNode.parentNode;

            var url = form.querySelector('.edit-modal__url').value;
            var login = form.querySelector('.edit-modal__login').value;
            var pass = form.querySelector('.edit-modal__password').value;

            if (!!url && !!login && !!pass) {

                PoolList.edit(num, url, login, pass);
                savePools();
                $.modal.close();
                $('.edit-modal__save').off('click');
                $('.edit-modal__delete').off('click');
            }



        });

        $('.edit-modal__delete').on('click', function(event) {

            PoolList.remove(num);
            PoolList.render();
            savePools();


            getActivePool(function (i) {
            	if(num == i) {
            		stopMiner();
            		changePool(-1);
            		getConf();
            		
            	} else if (num < i) {
            		changePool(i-1);
            		getConf();
            	}

            });

            $.modal.close();
            clearEditModal();
        });

        invokeEditModal();



    }

    //Modal methods

    function clearEditModal() {
        var modal = document.querySelector('#edit-modal');
        modal.querySelector('.edit-modal__url').value = '';
        modal.querySelector('.edit-modal__login').value = '';
        modal.querySelector('.edit-modal__password').value = '';

    }

    function setEditModalData(url, login, pass) {
        var modal = document.querySelector('#edit-modal');
        modal.querySelector('.edit-modal__url').value = url;
        modal.querySelector('.edit-modal__login').value = login;
        modal.querySelector('.edit-modal__password').value = pass;
    }

    function invokeEditModal() {
        $('#edit-modal').modal({
            fadeDuration: 250,
            fadeDelay: 0,
            closeClass: 'close-edit-modal',
            closeText: ''
        });
    }

    $$$('.edit-modal__cancel').addEventListener("click", function() {
        $.modal.close();
        clearEditModal();
    });

    //API functions

    function getConf() {
        tinyxhr('/api/getConfig', function(err, data) {
            if (!err) config = JSON.parse(data);
            applyConf(config);
        });
    }

    function applyConf(conf) {
        document.querySelector('.settings__chips').value = conf.chips;
        document.querySelector('.settings__clock').value = conf.clock;

        if (conf.activePool != -1 && !!PoolList.list.length) {
        	console.log(conf.activePool);
            var activePoolDot = $$('.pool-list__active')[conf.activePool];
            $$('.pool-list__active').forEach(function(element, index) {
                element.classList.remove('pool-online');
            });

            activePoolDot.classList.add('pool-online');

        } else {
        	$$('.pool-list__active').forEach(function(element, index) {
                element.classList.remove('pool-online');
            });
        }


    }


    function getPools() {
        tinyxhr('/api/getPools', function(err, data) {
            PoolList.update(JSON.parse(data));
            PoolList.refreshPing();


        }, 'GET');

    }

    function savePools() {
        tinyxhr('/api/savePools', function(err, data) {
            console.log(err, data);
        }, 'POST', JSON.stringify({
            "pools": PoolList.list
        }), 'application/javascript');

        console.log(JSON.stringify({
            "pools": PoolList.list
        }));
    }

    function getActivePool (cb) {
  		 tinyxhr('/api/getActivePool', function(err, data) {
            if (!err) cb(JSON.parse(data).num);
        });
    }

    function changePool(pool) {

        tinyxhr('/api/setActivePool/?pool=' + pool, function(err, data) {
            if (!err) getConf();

        }, 'GET');
    }

    function changeConf(chips, clock) {
        tinyxhr('/api/setConf/?chips=' + chips + '&clock=' + clock, function(err, data) {
            console.log(err);
        }, 'GET');
    }

    function getStats(cb) {
        tinyxhr('/api/getStats', function(err, data) {
            if (!err) cb(JSON.parse(data));
        });
    }

    function pingUrl(url, cb) {

        url = url.split('://')[1] ? url.split('://')[1] : url;

        url = url.split(':')[0] ? url.split(':')[0] : url;
        console.log(url);


        tinyxhr('/api/pingUrl/?url=' + url, function(err, data) {
            var ping = JSON.parse(data).time || -1;
            cb(ping);
        });


    }

    //Miner controls

    function startMiner() {
        tinyxhr('/api/startMiner', function(err) {
            console.log(err);
        });
    }

    function stopMiner() {
        tinyxhr('/api/stopMiner', function(err) {
            console.log(err);
        });
    }

    function restartMiner() {
        tinyxhr('/api/resetMiner', function(err) {
            console.log(err);
        });
    }

    function reboot() {
    	tinyxhr('/api/reboot', function(err) {
            console.log(err);
        });
    }

    function dropSettings() {
    	tinyxhr('/api/loadDefaults', function(err) {
            
            if(!err) {
            	
            	getConf();
            	getPools();
            	getStats();
            	PoolList.render();
            } else {
                console.log(err);
            }
        });
    }



    //Helper methods

    function tinyxhr(url, cb, method, post, contenttype) {
        var requestTimeout, xhr;
        try {
            xhr = new XMLHttpRequest();
        } catch (e) {
            try {
                xhr = new ActiveXObject("Msxml2.XMLHTTP");
            } catch (e) {
                if (console) console.log("tinyxhr: XMLHttpRequest not supported");
                return null;
            }
        }
        requestTimeout = setTimeout(function() {
            xhr.abort();
            cb(new Error("tinyxhr: aborted by a timeout"), "", xhr);
        }, 10000);
        xhr.onreadystatechange = function() {
            if (xhr.readyState != 4) return;
            clearTimeout(requestTimeout);
            cb(xhr.status != 200 ? new Error("tinyxhr: server respnse status is " + xhr.status) : false, xhr.responseText, xhr);
        }
        xhr.open(method ? method.toUpperCase() : "GET", url, true);

        //xhr.withCredentials = true;

        if (!post)
            xhr.send();
        else {
            xhr.setRequestHeader('Content-type', contenttype ? contenttype : 'application/x-www-form-urlencoded');
            xhr.send(post);
        }
    }


    // selects all nodes matched given selector

    function $$$(selector, ctx) {
        return (ctx || document).querySelector(selector);
    }


    function $$(selector, ctx) {
        return [].slice.call((ctx || document).querySelectorAll(selector));
    }


})();