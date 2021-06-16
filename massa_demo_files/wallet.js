wallet_addrs= {};
wallet_empty= true;
wallet_sending= false;
wallet_reading= false;

walletInit= function() {
    wallet_trans_progress= document.getElementById('wallet_trans_progress');
    wallet_addrtable= document.getElementById('addrtable');
    wallet_addrinput= document.getElementById('addressinput');
    wallet_savebtn= document.getElementById('wallet_save');
    wallet_loadbtn= document.getElementById('wallet_load');
    wallet_loadf= document.getElementById('wallet_loadf');
    wallet_addrinput.addEventListener("input", function() {
        wallet_addrinput.removeAttribute("aria-invalid");
    });
    wallet_sendfromaddr= document.getElementById('sendfromaddr');
    wallet_sendtoaddr= document.getElementById('sendtoaddr');
    wallet_sendtoaddr.addEventListener("input", function() {
        wallet_sendtoaddr.removeAttribute("aria-invalid");
    });
    wallet_sendamount= document.getElementById('sendamount');
    wallet_sendamount.addEventListener("input", function() {
        wallet_sendamount.removeAttribute("aria-invalid");
    });
    wallet_sendfee= document.getElementById('sendfee');
    wallet_sendfee.addEventListener("input", function() {
        wallet_sendfee.removeAttribute("aria-invalid");
    });
    
    wallet_loadf.addEventListener('change', function(e) {
        if(!wallet_sending && !wallet_reading)
            wallet_upload();
    });
    
    wallet_loadbtn.addEventListener("click", function(e) {
        var confirmed= !wallet_sending && !wallet_reading;
        if(confirmed && !wallet_empty)
            confirmed= confirm("The currently loaded wallet will be discared, and lost if not saved.\nConfirm loading a new wallet ?");
        if(!confirmed)
            e.preventDefault();
    });
    wallet_savebtn.addEventListener("click", function() {
        if(!wallet_empty && !wallet_sending && !wallet_reading)
            wallet_download();
    });

    document.getElementById('genaddr').addEventListener("click", function() {
        var version= 0;
        wallet_addrinput.value= xbqcrypto.deduce_private_base58check(xbqcrypto.generate_random_privkey(), version);
        wallet_addrinput.removeAttribute("aria-invalid");
    });
    document.getElementById('waddr_add').addEventListener("submit", function(e) {
        e.preventDefault();
        var reskey= null;
        // validate format
        try {
            reskey= parse_textprivkey(wallet_addrinput.value);
        }
        catch(e) {console.log(e)}
        
        if(reskey != null) {
            wallet_addrinput.removeAttribute("aria-invalid");
            wallet_addrinput.value= '';
            wallet_add_key(reskey);
        }
        else
            wallet_addrinput.setAttribute("aria-invalid", "true");
       
    }, false);
    document.getElementById('trans_send').addEventListener("submit", function(e) {
        e.preventDefault();
        var restransac= null;
        // validate sender address
        var sendfrompubkey= null;
        var sendfromprivkey= null;
        var sendfromversion= null;
        var sendfromaddr= null;
        var sendtoaddr= null;
        try {
            if(!wallet_addrs.hasOwnProperty(wallet_sendfromaddr.value))
                throw "Unknown source address."
            var tmpkey= wallet_addrs[wallet_sendfromaddr.value].key;
            sendfrompubkey= tmpkey.pubkey;
            sendfromprivkey= tmpkey.privkey;
            sendfromversion= tmpkey.version;
            sendfromaddr= tmpkey.address;
        } catch(e) { }
        // validate destination address
        var sendtoaddr= null;
        var sendtopkh= null;
        try {
            var parsed= xbqcrypto.parse_address(wallet_sendtoaddr.value);
            sendtoversion= parsed.version;
            sendtopkh= parsed.pubkeyhash;
            sendtoaddr= wallet_sendtoaddr.value;
            wallet_sendtoaddr.removeAttribute("aria-invalid");
        } catch(e) {
            wallet_sendtoaddr.setAttribute("aria-invalid", "true");
        }
        // validate amount
        var sendamount= null;
        try {
            sendamount= parseInt(Math.round(Number(wallet_sendamount.value) * 1e8));
            if(isNaN(sendamount) || sendamount < 0 || sendamount > (Math.pow(2, 47) - 1))
                throw "Invalid amount.";
            wallet_sendamount.removeAttribute("aria-invalid");
            wallet_sendamount.value= sendamount / 1e8;
        } catch(e) {
            sendamount= null;
            wallet_sendamount.setAttribute("aria-invalid", "true");
        }
        // validate fee
        var sendfee= null;
        try {
            sendfee= parseInt(Math.round(Number(wallet_sendfee.value) * 1e8));
            if(isNaN(sendfee) || (sendfee < 0) || (sendfee > (Math.pow(2, 24) - 1)))
                throw "Invalid fee.";
            wallet_sendfee.removeAttribute("aria-invalid");
            wallet_sendfee.value= sendfee / 1e8;
        } catch(e) {
            sendfee= null;
            wallet_sendfee.setAttribute("aria-invalid", "true");
        }
        var everythingok= (sendfromaddr != null && sendfrompubkey != null && sendfromprivkey != null && sendfromversion != null
            && sendtoaddr != null && sendtopkh != null && sendtoversion != null && sendamount != null && sendfee != null);
        
        // Confirm
        if(everythingok) {
            var confirm_message= "Transaction summary:\n"
                + "\tFrom: " +  sendfromaddr + "\n"
                + "\tTo: " +  sendtoaddr + "\n"
                + "\tAmount: " +  (sendamount/1e8) + " coins\n"
                + "\tFee: " +  (sendfee/1e8) + " coins\n"
                + "\nPlease confirm this transaction.";
            everythingok= confirm(confirm_message);
        }
        
        // generate transaction
        if(everythingok) {
            try {
                var transac= xbqcrypto.Buffer.alloc(132);
                
                // Version (0 -> 1)
                var version= 0;
                transac.writeUInt8(version, 0);
                
                // Timestamp shifted so that 0 => 1st january 2018 at 00:00:00. (1 -> 5)
                var timestamp= xbqcrypto.get_timestamp();
                if(timestamp < 0 || timestamp > (Math.pow(2, 32)-1))
                    throw "Timestamp invalid.";
                transac.writeUInt32BE(timestamp, 1);
                
                // destination version and address (5 -> 26)
                transac.writeUInt8(sendtoversion, 5);
                transac.write(sendtopkh.toString('binary'), 6, 20, 'binary');

                // fee (26 -> 29)
                transac.writeUIntBE(sendfee, 26, 3);
                
                // from pubkey (29 -> 62) + reminder byte
                var frompkh_extrabyte= (sendfrompubkey[0] == 0x03 ? 128 : 0); 
                var frompkh_mainpart= sendfrompubkey.slice(1);
                transac.writeUInt8(sendfromversion, 29);
                transac.write(frompkh_mainpart.toString('binary'), 30, 32, 'binary');
                
                // amount (62 -> 68)
                var resamount48= parseInt(sendamount + (frompkh_extrabyte * Math.pow(2, 8*5)));
                transac.writeUIntBE(resamount48, 62, 6);
                
                // signature (68 -> 132)
                var signature= xbqcrypto.sign_data(transac.slice(0, 68), sendfromprivkey);
                transac.write(signature.toString('binary'), 68, 64, 'binary');
                
                /*
                //verification
                var reconstpubkey= xbqcrypto.Buffer.concat([ xbqcrypto.Buffer.from( (transac.readUInt8(62) >= 128 ? [0x03] : [0x02]) ) ,
                                                             transac.slice(30, 30+32) ]);
                var verif= xbqcrypto.verify_data_signature(transac.slice(0, 68), transac.slice(68), reconstpubkey)
                alert(verif)
                */
                
                restransac= transac;
            } catch(e) { alert('Error while generating transaction: ' + e); }
        }
        // send transaction
        if(restransac != null) {
            var restransacb64= restransac.toString('base64');
            wallet_sending= true;
            wallet_update_sendform();
            wallet_update_info();
            walletSendTransaction(restransacb64);
        }
       
    }, false);
    wallet_update_sendform();
    wallet_update_info();
    finished_loading('wallet_init');
}

parse_textprivkey= function(txt) {
    var parsed= xbqcrypto.parse_private_base58check(txt);
    var version= parsed.version;
    var privkey= parsed.privkey;
    var pubkey= xbqcrypto.get_pubkey_from_privkey(privkey);
    var addr= xbqcrypto.deduce_address(pubkey, version);
    var thread= xbqcrypto.get_address_thread(addr);
    var b58cpubkey= xbqcrypto.deduce_public_base58check(pubkey, version);
    return {address: addr, b58cprivkey: txt, privkey: privkey, b58cpubkey: b58cpubkey, pubkey: pubkey, version: version, thread: thread};
}

wallet_upload= function() {
    try {
        if(wallet_loadf.files.length != 1)
            return;
        var reader = new FileReader();
        reader.onload = function(evt) {
            try {
                var resobj = JSON.parse(evt.target.result);
                if(resobj.magic !== 'blockclique_wallet')
                    throw "Invalid magic.";
                var version= resobj.version;
                if(version !== "0")
                    throw "Invalid wallet version.";
                var privs= resobj.privkeys;
                var new_addrs= {};
                for(var i= 0 ; i < privs.length ; i++) {
                    var reskey= parse_textprivkey(privs[i]);
                    new_addrs[reskey.address]= {'key':reskey, 'balance':null}
                }
                wallet_addrs= new_addrs;
                wallet_reading= false;
                walletUpdateBalancesInfo();
            } catch(e) {
                alert('Wallet loading failed.\nPlease make sure the file is valid and not corrupted.');
            }
            wallet_reading= false;
            wallet_update_sendform();
            wallet_update_info();
        };
        wallet_reading= true;
        wallet_update_sendform();
        wallet_update_info();
        reader.readAsText(wallet_loadf.files.item(0));
    } catch(e) {
        alert('Wallet loading failed.\nPlease make sure the file is valid and not corrupted.');
        wallet_reading= false;
        wallet_update_sendform();
        wallet_update_info();
    }
}

wallet_download= function() {
    var resprivkeys= [];
    for(var k in wallet_addrs) {
        if(wallet_addrs.hasOwnProperty(k)) 
            resprivkeys.push(wallet_addrs[k].key.b58cprivkey);
    }
    var resJSON= {'magic': 'blockclique_wallet',
                  'version':'0',
                  'privkeys':resprivkeys};
    var dlanchor= document.getElementById('wallet_dlanchor');
    var datastr= "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(resJSON));
    dlanchor.setAttribute("href", datastr);
    dlanchor.setAttribute("download", "blockclique_wallet.json");
    dlanchor.click();
}

wallet_add_key= function(key) {

    console.log('ici')

    // Get address and check if already exists
    if(wallet_addrs.hasOwnProperty(key.address)) {
        alert('Address already present in wallet.');
        return;
    }
    // Add to list
    wallet_addrs[key.address]= {key:key, balance:null}
    // Update list
    wallet_update_sendform();
    // Update balances
    walletUpdateBalancesInfo();
    // Update info
    wallet_update_info();
}

wallet_update_sendform= function() {
    var restabhtml= '';
    var rescombohtml= '';
    for(var k in wallet_addrs) {
        if(!wallet_addrs.hasOwnProperty(k)) 
            continue
        var res_amount= wallet_addrs[k].balance;
        if(res_amount == null)
            res_amount = '...';
        else
            res_amount= res_amount.toString();
        var delkeyid= 'wallet_delkey_' + k;
        var copykeyid= 'wallet_copykey_' + k;
        restabhtml += '<tr><td class="ellipsis"><div><a href="#explorer_search?explore=' + k + '" class="keylink">'
            + k + '</a></div></td><td class="smalltd">' + wallet_addrs[k].key.thread + '</td><td class="smalltd" id="wallet_balance_'+k+'">' + res_amount 
            + '</td><td class="smalltd"><a class="copy" id="'+copykeyid+'">📋</a>&emsp;<a class="delete" id="'+delkeyid+'">✘︎</a></td></tr>';
        rescombohtml += '<option value="' + k + '">' + k + '</option>';
    }
    var combobox= document.getElementById('sendfromaddr'); // To retrieve the previous selection if it still exists
    var othercombobox= document.getElementById('staker_address');
    if(othercombobox == null)
        othercombobox= document.getElementById('miner_address');
    var prevcombosel= combobox.value;
    var prevothercombosel= othercombobox.value;
    combobox.innerHTML= rescombohtml;
    othercombobox.innerHTML= rescombohtml;
    if(rescombohtml == '') {
        wallet_addrtable.innerHTML= '';
        document.getElementById('trans_send').style.display= "none";
        wallet_trans_progress.innerHTML= 'Add at least one address to send transactions.';
    } else {
        wallet_addrtable.innerHTML= '<tr><th>Address</th><th class="smalltd">Thread</th><th class="smalltd">Final Balance</th><th class="smalltd"></th></tr>' + restabhtml;
        document.getElementById('trans_send').style.display= "";
        wallet_trans_progress.innerHTML= '';
    }
    if(wallet_sending) {
        document.getElementById('trans_send').style.display= "none";
        wallet_trans_progress.innerHTML= 'Sending transaction...';
    }
    if(wallet_reading) {
        document.getElementById('trans_send').style.display= "none";
        wallet_trans_progress.innerHTML= 'Reading wallet...';
    }
    if(wallet_addrs.hasOwnProperty(prevcombosel))
        combobox.value= prevcombosel;
    if(wallet_addrs.hasOwnProperty(prevothercombosel))
        othercombobox.value= prevothercombosel;
    
    for(var k in wallet_addrs) {
        if(!wallet_addrs.hasOwnProperty(k))
            continue;
        var delkeyid= 'wallet_delkey_' + k;
        var copykeyid= 'wallet_copykey_' + k;
        document.getElementById(delkeyid).addEventListener("click", function(key){return function(){
            if(confirm("Are you sure you want to delete the address " + key + " from your wallet ?")) {
                delete wallet_addrs[key]
                wallet_update_sendform();
                wallet_update_info();
            }
        }}(k));
        document.getElementById(copykeyid).addEventListener("click", function(key){return function(){
            try {
                copyToClipboard(key);
                alert('Address copied to clipboard:\n' + key);
            } catch(e) {
                alert('Could not copy address to clipboard, do it yourself:\n' + key);
            }
        }}(k));
    }   
}

wallet_confirmquit= function() {
    return 'Any unsaved addresses will be lost. Are you sure you want to quit ?';
}

wallet_update_info= function() {
    var totbalance= 0;
    var naddr= 0;
    for(var k in wallet_addrs) {
        if(!wallet_addrs.hasOwnProperty(k)) 
            continue;
        naddr += 1;
        if(totbalance == null)
            continue
        var tmpb= wallet_addrs[k].balance;
        if(tmpb == null)
            totbpance= null;
        else
            totbalance += parseFloat(tmpb);
    }
    if(totbalance == null)
        totbalance= 'Loading...';
    wallet_empty= (naddr == 0);
    window.onbeforeunload = (wallet_empty ? null : wallet_confirmquit);
    
    document.getElementById('wallet_totbalance').innerHTML= 'Final balance:&nbsp;<b>' + totbalance + '&nbsp;coins</b>';
    document.getElementById('wallet_naddresses').innerHTML= 'Number of addresses:&nbsp;<b>' + naddr + '</b>';
    wallet_savebtn.style.display= (wallet_empty || wallet_sending || wallet_reading ? 'none' : '');
    wallet_loadbtn.style.display= (wallet_sending || wallet_reading ? 'none' : '');
}


var walletSendTransactionXhr= null;
var walletSendTransactionTimeout= null;
walletSendTransaction= function(data) {
	if(walletSendTransactionTimeout != null) { clearTimeout(walletSendTransactionTimeout); walletSendTransactionTimeout=null; }
	if(walletSendTransactionXhr != null) { var tmp=walletSendTransactionXhr; walletSendTransactionXhr=null; tmp.abort(); }
	
	function onresponse(resJson, xhr) {
		walletSendTransactionXhr= null;
		if(resJson.result == "OK") {
		    alert('Transaction was successfully sent:\n' + resJson.txId);
		    document.getElementById('trans_send').reset();
		    openhash('#explorer?explore=' + encodeURIComponent(resJson.txId));
		} else {
		    alert('An error occured while sending the transaction: ' + resJson.errorMessage + '. Transaction not sent.');
		}
	    wallet_sending= false;
	    wallet_update_sendform();
	    wallet_update_info();
	}
	function onerror(error, xhr) {
		if(walletSendTransactionXhr != null) { // yeah, otherwise we actually wanted it to die
			walletSendTransactionXhr= null;
			if(confirm('An network error occured while sending the transaction: '+ error +'. Retry ?')) {
			    walletSendTransaction(data);
			} else {
			    wallet_sending= false;
			    wallet_update_sendform();
			    wallet_update_info();
			}
		}
	}
	walletSendTransactionXhr= RESTRequest("PUT", 'createTransaction', 'txb64='+encodeURIComponent(data), onresponse, onerror);
}


var walletUpdateBalancesXhr= null
var walletUpdateBalancesTimeout= null
walletUpdateBalancesInfo= function() {
	if(walletUpdateBalancesTimeout != null) { clearTimeout(walletUpdateBalancesTimeout); walletUpdateBalancesTimeout=null; }
	if(walletUpdateBalancesXhr != null) { var tmp=walletUpdateBalancesXhr; walletUpdateBalancesXhr=null; tmp.abort(); }

	function onresponse(resJson, xhr) {
		walletUpdateBalancesXhr= null;
		
		for(var k in resJson) {
            if(!resJson.hasOwnProperty(k))
                continue;

            console.log(resJson)

            for (var k in wallet_addrs) {

                var thread = wallet_addrs[k].key.thread
                // thread = 29

                console.log('lulu')
                console.log(wallet_addrs[k].key.thread)
                console.log(resJson.final_data.data[thread])
                // console.log(resJson.final_data.data)

                wallet_addrs[k].balance = parseFloat(resJson.final_data.data[thread].k.balance);
                var balancefield= document.getElementById('wallet_balance_'+k);
                if(!balancefield)
                    continue;
                balancefield.innerHTML= wallet_addrs[k].balance;
            }


            // if(wallet_addrs.hasOwnProperty(k)) {
            //     wallet_addrs[k].balance= parseFloat(resJson[k]);
            //     var balancefield= document.getElementById('wallet_balance_'+k);
            //     if(!balancefield)
            //         continue;
            //     balancefield.innerHTML= wallet_addrs[k].balance;
            // }
		}
		wallet_update_info();
		walletUpdateBalancesTimeout= setTimeout(walletUpdateBalancesInfo, 10000, false)
	}
	function onerror(error, xhr) {
		if(walletUpdateBalancesXhr != null) { // yeah, otherwise we actually wanted it to die
			walletUpdateBalancesXhr= null;
			walletUpdateBalancesTimeout= setTimeout(walletUpdateBalancesInfo, 3000, false)
		}
	}
	
    console.log('lala')
    console.log(wallet_addrs)

    var reqval= '';
    var idx = 0
	for (var k in wallet_addrs) {

        console.log('k')
        console.log(k)

        if(!wallet_addrs.hasOwnProperty(k))
            continue;
	    reqval += (reqval == '' ? '?addrs[' + encodeURIComponent(idx) +']=' : '&addrs[' + encodeURIComponent(idx) +']=') + encodeURIComponent(k);
        idx += 1
    }
	if(reqval != '')
        // walletUpdateBalancesXhr= RESTRequest("GET", 'addresses_data?addrs[0]=2oxLZc6g6EHfc5VtywyPttEeGDxWq3xjvTNziayWGDfxETZVTi&' + reqval, null, onresponse, onerror);
        walletUpdateBalancesXhr= RESTRequest("GET", 'addresses_data' + reqval, null, onresponse, onerror);
}

