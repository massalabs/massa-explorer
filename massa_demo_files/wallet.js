latest_period = null
var walletUpdateLatestPeriodXhr= null
var walletUpdateLatestPeriodTimeout= null
getLatestPeriod = function() {
    if(walletUpdateLatestPeriodTimeout != null) { clearTimeout(walletUpdateLatestPeriodTimeout); walletUpdateLatestPeriodTimeout=null; }
	if(walletUpdateLatestPeriodXhr != null) { var tmp=walletUpdateLatestPeriodXhr; walletUpdateLatestPeriodXhr=null; tmp.abort(); }
	function onresponse(resJson, xhr) {
        walletUpdateLatestPeriodXhr = null;

		latest_period = resJson.latest_slot.period
        walletUpdateLatestPeriodTimeout= setTimeout(getLatestPeriod, 10000, false)
	}
	function onerror(error, xhr) {
		if(walletUpdateLatestPeriodXhr != null) { // yeah, otherwise we actually wanted it to die
			walletUpdateLatestPeriodXhr = null;
            walletUpdateLatestPeriodTimeout = setTimeout(getLatestPeriod, 10000, false)
		}
	}
	RESTRequest("GET", "state", null, onresponse, onerror);
}
getLatestPeriod()

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
    wallet_sendfee = document.getElementById('sendfee');
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
        wallet_addrinput.value= xbqcrypto.deduce_private_base58check(window.crypto.getRandomValues(new Uint8Array(32)));
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
        var sendfromaddr= null;
        var sendtoaddr= null;
        try {
            if(!wallet_addrs.hasOwnProperty(wallet_sendfromaddr.value))
                throw "Unknown source address."
            var tmpkey= wallet_addrs[wallet_sendfromaddr.value].key;
            sendfrompubkey= tmpkey.pubkey;
            sendfromprivkey= tmpkey.privkey;
            sendfromaddr= tmpkey.address;
            sendfromb58cpubkey = tmpkey.b58cpubkey
            sendfromb58cprivkey = tmpkey.b58cprivkey
        } catch(e) { }
        // validate destination address
        var sendtoaddr= null;
        var sendtopkh= null;
        try {
            var parsed= xbqcrypto.parse_address(wallet_sendtoaddr.value);
            sendtopkh= parsed.pubkeyhash;
            sendtoaddr= wallet_sendtoaddr.value;
            wallet_sendtoaddr.removeAttribute("aria-invalid");
        } catch(e) {
            wallet_sendtoaddr.setAttribute("aria-invalid", "true");
        }
        // validate amount
        var sendamount= null;
        try {
            sendamount = new Decimal(parseInt(new Decimal(wallet_sendamount.value).times(1e9))).dividedBy(1e9);
            let sendamount_mul = sendamount.times(1e9);
            if(isNaN(sendamount_mul) || sendamount_mul < 0 || sendamount_mul > (Math.pow(2, 64) - 1))
                throw "Invalid amount.";
            wallet_sendamount.removeAttribute("aria-invalid");
            wallet_sendamount.value = sendamount;
        } catch(e) {
            sendamount= null;
            wallet_sendamount.setAttribute("aria-invalid", "true");
        }
        // validate fee
        var sendfee = null;
        try {
            if(wallet_sendfee.value == "") {
                wallet_sendfee.value = 0;
            }
            sendfee = new Decimal(parseInt(new Decimal(wallet_sendfee.value).times(1e9))).dividedBy(1e9);
            let sendfee_mul = sendfee.times(1e9);
            if(isNaN(sendfee_mul) || (sendfee_mul < 0) || (sendfee_mul > (Math.pow(2, 64) - 1)))
                throw "Invalid fee.";
            wallet_sendfee.removeAttribute("aria-invalid");
            wallet_sendfee.value = sendfee;
        } catch(e) {
            sendfee= null;
            wallet_sendfee.setAttribute("aria-invalid", "true");
        }
        var everythingok= (sendfromaddr != null && sendfrompubkey != null && sendfromprivkey != null
            && sendtoaddr != null && sendtopkh != null && sendamount != null && sendfee != null);
        
        // Confirm
        if(everythingok) {
            var confirm_message= "Transaction summary:\n"
                + "\tFrom: " +  sendfromaddr + "\n"
                + "\tTo: " +  sendtoaddr + "\n"
                + "\tAmount: " +  sendamount + " coins\n"
                + "\tFee: " +  sendfee + " coins\n"
                + "\nPlease confirm this transaction.";
            everythingok= confirm(confirm_message);
        }

        // generate transaction
        if(everythingok) {
            try {
                var transac = {"content": {"op": {"Transaction": {}}}}

                transac.content["sender_public_key"] = sendfromb58cpubkey
                transac.content["fee"] = sendfee.toString()
                transac.content["expire_period"] = latest_period + 5
                transac.content.op.Transaction["recipient_address"] = sendtoaddr
                transac.content.op.Transaction["amount"] = sendamount.toString()
                
                var privkey = Secp256k1.uint256(xbqcrypto.base58check_decode(sendfromb58cprivkey), 16)
                transac["signature"] = sign_content(transac, privkey)
            } catch(e) { alert('Error while generating transaction: ' + e); }
        }
        // send transaction
        if(transac != null) {
            wallet_sending= true;
            wallet_update_sendform();
            wallet_update_info();
            walletSendTransaction(transac);
        }
       
    }, false);
    wallet_update_sendform();
    wallet_update_info();
    finished_loading('wallet_init');
}

function sign_content(transaction, privkey) {    
    // Compute bytes compact
    let parsed_fee = parseInt(new Decimal(transaction.content.fee).times(1e9));
    let parsed_amount = parseInt(new Decimal(transaction.content.op.Transaction.amount).times(1e9));
    var encoded_data = xbqcrypto.compute_bytes_compact(parsed_fee, transaction.content.expire_period,
    transaction.content.sender_public_key, 0, transaction.content.op.Transaction.recipient_address, parsed_amount)

    // Hash byte compact
    var hash_encoded_data = xbqcrypto.hash_sha256(encoded_data)

    // Signing a digest
    var digest = Secp256k1.uint256(hash_encoded_data)
    const sig = Secp256k1.ecsign(privkey, digest)
    return xbqcrypto.base58check_encode(xbqcrypto.Buffer.concat([xbqcrypto.Buffer.from(sig.r, "hex"), xbqcrypto.Buffer.from(sig.s, "hex")]))
}

parse_textprivkey= function(txt) {
    // Parse private key
    var parsed = xbqcrypto.parse_private_base58check(txt);
    var privkey= parsed.privkey;
    privkey = Secp256k1.uint256(privkey, 16)
    // Get pubkey
    var pubkey = Secp256k1.generatePublicKeyFromPrivateKeyData(privkey);
    pubY = Secp256k1.uint256(pubkey.y, 16)
    var prefix = (pubY.isEven() ? 0x02 : 0x03);
    prefix = xbqcrypto.Buffer.from([prefix], "hex")
    var pubkey = xbqcrypto.Buffer.concat([prefix, xbqcrypto.Buffer.from(pubkey.x, "hex")])
    // Get address
    var addr = xbqcrypto.deduce_address(pubkey);
    // Get thread
    var thread = xbqcrypto.get_address_thread(addr);
    // Get base58check pubkey
    var b58cpubkey = xbqcrypto.deduce_public_base58check(pubkey);
    return {address: addr, b58cprivkey: txt, privkey: privkey, b58cpubkey: b58cpubkey, pubkey: pubkey, thread: thread};
}

wallet_upload= function() {
    try {
        if(wallet_loadf.files.length != 1)
            return;
        var reader = new FileReader();
        reader.onload = function(evt) {
            try {
                var resobj = JSON.parse(evt.target.result);
                var privs= resobj;
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
    var resJSON= resprivkeys;
    var dlanchor= document.getElementById('wallet_dlanchor');
    var datastr= "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(resJSON));
    dlanchor.setAttribute("href", datastr);
    dlanchor.setAttribute("download", "wallet.dat");
    dlanchor.click();
}

wallet_add_key= function(key) {
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
        else {
            res_amount = new Decimal(res_amount)
            res_amount = res_amount.toString();
        }
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
    // var prevothercombosel= othercombobox.value;
    combobox.innerHTML= rescombohtml;
    // othercombobox.innerHTML= rescombohtml;
    if(rescombohtml == '') {
        wallet_addrtable.innerHTML= '';
        document.getElementById('trans_send').style.display= "none";
        wallet_trans_progress.innerHTML= 'Add at least one address to send transactions.';
    } else {
        wallet_addrtable.innerHTML= '<tr><th>Address</th><th class="smalltd">Thread</th><th class="smalltd">Balance</th><th class="smalltd"></th></tr>' + restabhtml;
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
    // if(wallet_addrs.hasOwnProperty(prevothercombosel))
    //     othercombobox.value = prevothercombosel;
    
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
    var totbalance = 0;
    var naddr = 0;
    for(var k in wallet_addrs) {
        if(!wallet_addrs.hasOwnProperty(k)) 
            continue;
        naddr += 1;
        if(totbalance == null)
            continue
        var tmpb = wallet_addrs[k].balance;
        if(tmpb == null)
            totbpance= null;
        else
            totbalance += parseFloat(tmpb);
    }
    if(totbalance == null)
        totbalance= 'Loading...';
    else {
        totbalance = totbalance;
        // totbalance.toString()
    }
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
        if(Array.isArray(resJson)) {
            document.getElementById('trans_send').reset();
            alert('Transaction was successfully sent:\n' + resJson[0]);
            openhash('#explorer?explore=' + encodeURIComponent(resJson[0]));
        }
        else {
		    alert('An error occured while sending the transaction. Transaction not sent.');
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
	// walletSendTransactionXhr= RESTRequest("PUT", 'createTransaction', 'txb64='+encodeURIComponent(data), onresponse, onerror);
    data = JSON.stringify([data])
    walletSendTransactionXhr = RESTRequest("POST", 'send_operations', data, onresponse, onerror);
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
            for (var k in wallet_addrs) {
                wallet_addrs[k].balance = new Decimal(resJson[k].final_ledger_data.balance).toString();
                wallet_addrs[k].candidate_balance = new Decimal(resJson[k].candidate_ledger_data.balance).toString();
                var balancefield = document.getElementById('wallet_balance_'+k);
                if(!balancefield)
                    continue;
                if (wallet_addrs[k].balance == wallet_addrs[k].candidate_balance) {
                    balancefield.innerHTML = wallet_addrs[k].balance;
                }
                else
                    balancefield.innerHTML = wallet_addrs[k].balance + '<br>(' + wallet_addrs[k].candidate_balance + ')';
            }
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

    var reqval= '';
    var idx = 0
	for (var k in wallet_addrs) {
        if(!wallet_addrs.hasOwnProperty(k))
            continue;
	    reqval += (reqval == '' ? '?addrs[' + encodeURIComponent(idx) +']=' : '&addrs[' + encodeURIComponent(idx) +']=') + encodeURIComponent(k);
        idx += 1
    }
	if(reqval != '')
        walletUpdateBalancesXhr= RESTRequest("GET", 'addresses_info' + reqval, null, onresponse, onerror);
}
