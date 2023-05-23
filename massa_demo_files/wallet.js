async function sign(transac, privkey) {
    var signature = await xbqcrypto.sign(transac, privkey);
    return signature
}

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
        wallet_addrinput.value = xbqcrypto.deduce_private_base58check(xbqcrypto.generate_random_privkey());
        wallet_addrinput.removeAttribute("aria-invalid");
    });
    document.getElementById('waddr_add').addEventListener("submit", function(e) {
        e.preventDefault();
        // validate format
        try {
            parse_textprivkey(wallet_addrinput.value).then(
                (reskey) => {
                    var reskey = reskey;
                    if(reskey != null) {
                        wallet_addrinput.removeAttribute("aria-invalid");
                        wallet_addrinput.value= '';
                        wallet_add_key(reskey);
                    }
                    else
                        wallet_addrinput.setAttribute("aria-invalid", "true");
                }
            );
        }
        catch(e) {console.log(e)}
       
    }, false);
    document.getElementById('trans_send').addEventListener("submit", function(e) {
        e.preventDefault();
        // validate sender address
        var sendfrompubkey= null;
        var sendfromprivkey= null;
        var sendfromaddr= null;
        var sendtoaddr= null;
        try {
            if(!wallet_addrs.hasOwnProperty(wallet_sendfromaddr.value))
                throw "Unknown source address."
            var tmpkey = wallet_addrs[wallet_sendfromaddr.value].key;
            sendfrompubkey = tmpkey.pubkey;
            sendfromprivkey = tmpkey.privkey;
            sendfromaddr = tmpkey.address;
            sendfromb58cpubkey = tmpkey.b58cpubkey
            sendfromb58cprivkey = tmpkey.b58cprivkey
        } catch(e) { }
        // validate destination address
        var sendtoaddr= null;
        var sendtopkh= null;
        try {
            var parsed = xbqcrypto.parse_address(wallet_sendtoaddr.value);
            sendtopkh = parsed.pubkeyhash;
            sendtoaddr = wallet_sendtoaddr.value;
            wallet_sendtoaddr.removeAttribute("aria-invalid");
        } catch(e) {
            wallet_sendtoaddr.setAttribute("aria-invalid", "true");
        }
        // validate amount
        var sendamount= null;
        try {
            sendamount = new Decimal(wallet_sendamount.value);
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
            sendfee = new Decimal(wallet_sendfee.value);
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
                
                const sender_public_key = sendfromb58cpubkey
                const fee = sendfee.toString()
                const expire_period = latest_period + 5
                const recipient_address = sendtoaddr
                const amount = sendamount.toString()

                var privkey = xbqcrypto.parse_private_base58check(sendfromb58cprivkey);

                const bytesCompact = compute_bytes_compact(fee, amount, expire_period, recipient_address);
                sign_content(bytesCompact, sender_public_key, privkey);
            } catch(e) { alert('Error while generating transaction: ' + e); }
        }
        // send transaction
        if(data != null) {
            wallet_sending = true;
            wallet_update_sendform();
            wallet_update_info();
            // walletSendTransaction(transac);
        }
       
    }, false);
    wallet_update_sendform();
    wallet_update_info();
    finished_loading('wallet_init');
}

compute_bytes_compact = function(fee, amount, expire_period, recipient_address) {
    let parsed_fee = parseInt(new Decimal(fee).times(1e9));
    let parsed_amount = parseInt(new Decimal(amount).times(1e9));
    var bytesCompact = xbqcrypto.compute_bytes_compact(parsed_fee, expire_period, 0, recipient_address, parsed_amount)
    return bytesCompact;
}

sign_content = function(bytesCompact, sender_public_key, privkey) {
    const byte_pubkey = xbqcrypto.base58check_decode(sender_public_key.slice(1)).slice(1);
    const toSignData = xbqcrypto.Buffer.concat([byte_pubkey, bytesCompact]);
    var hash_encoded_data = xbqcrypto.hash_blake3(toSignData);
    // Signing a digest
    sign(hash_encoded_data, privkey).then((signature) => {
        const data = {
            serialized_content: Array.prototype.slice.call(bytesCompact),
            creator_public_key: sender_public_key,
            signature: xbqcrypto.base58check_encode(signature),
        };
        walletSendTransaction(data);
    });
}

parse_textprivkey = async function(txt) {
    var privkey = xbqcrypto.parse_private_base58check(txt);
    var pubkey = await xbqcrypto.get_pubkey(privkey);
    var version = xbqcrypto.Buffer.from(xbqcrypto.varint_encode(0));
    var b58cpubkey = 'P' + xbqcrypto.base58check_encode(xbqcrypto.Buffer.concat([version,pubkey]));
    var version = xbqcrypto.Buffer.from(xbqcrypto.varint_encode(0));
    var addr = 'AU' + xbqcrypto.base58check_encode(xbqcrypto.Buffer.concat([version, xbqcrypto.hash_blake3(pubkey)]))
    var thread = xbqcrypto.get_address_thread(addr);
    var parsed_privkey = {address: addr, b58cprivkey: txt, privkey: privkey, b58cpubkey: b58cpubkey, pubkey: pubkey, thread: thread};
    return parsed_privkey
}

wallet_upload = function() {
    try {
        if(wallet_loadf.files.length != 1)
            return;
        var reader = new FileReader();
        reader.onload = function(evt) {
            try {
                var resobj = JSON.parse(evt.target.result);
                var privs = resobj;
                var new_addrs = {};
                for(var i= 0 ; i < privs.length ; i++) {
                    var reskey = parse_textprivkey(privs[i]);
                    new_addrs[reskey.address] = {'key':reskey, 'balance':null}
                }
                wallet_addrs = new_addrs;
                wallet_reading = false;
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
    var resJSON = resprivkeys;
    var dlanchor = document.getElementById('wallet_dlanchor');
    var datastr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(resJSON));
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
			walletSendTransactionXhr = null;
			if(confirm('An network error occured while sending the transaction: '+ error.message +'. Retry ?')) {
			    walletSendTransaction(data);
			} else {
			    wallet_sending= false;
			    wallet_update_sendform();
			    wallet_update_info();
			}
		}
	}
    walletSendTransactionXhr = JsonRPCRequest('send_operations', [[data]], onresponse, onerror);
}

var walletUpdateBalancesXhr= null
var walletUpdateBalancesTimeout= null
walletUpdateBalancesInfo= function() {
	if(walletUpdateBalancesTimeout != null) { clearTimeout(walletUpdateBalancesTimeout); walletUpdateBalancesTimeout=null; }
	if(walletUpdateBalancesXhr != null) { var tmp=walletUpdateBalancesXhr; walletUpdateBalancesXhr=null; tmp.abort(); }

	function onresponse(resJson, xhr) {
		walletUpdateBalancesXhr= null;

        for (var i=0; i < resJson.length; i++) {
            wallet_addrs[resJson[i].address].balance = resJson[i].final_balance;
            wallet_addrs[resJson[i].address].candidate_balance = resJson[i].candidate_balance;
            var balancefield = document.getElementById('wallet_balance_'+resJson[i].address);
            if(!balancefield)
                continue;
            if (wallet_addrs[resJson[i].address].balance == wallet_addrs[resJson[i].address].candidate_balance) {
                balancefield.innerHTML = wallet_addrs[resJson[i].address].balance;
            }
            else
                balancefield.innerHTML = wallet_addrs[resJson[i].address].balance + '<br>(' + wallet_addrs[resJson[i].address].candidate_balance + ')';
        }
		wallet_update_info();
		walletUpdateBalancesTimeout= setTimeout(walletUpdateBalancesInfo, 10000, false)
	}
	function onerror(error, xhr) {
		if(walletUpdateBalancesXhr != null) { // yeah, otherwise we actually wanted it to die
			walletUpdateBalancesXhr= null;
			walletUpdateBalancesTimeout= setTimeout(walletUpdateBalancesInfo, 10000, false)
		}
	}

    var reqval = []
	for (var k in wallet_addrs) {
        if(!wallet_addrs.hasOwnProperty(k))
            continue;
        reqval.push(k)
    }
	if(reqval != '')
        data = [reqval]
        walletUpdateBalancesXhr = JsonRPCRequest('get_addresses', data, onresponse, onerror);
}
