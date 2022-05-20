pages= ['explorer', 'wallet', 'staking', 'about'];
defaultpage= 'explorer';
loading_status= {};
loading_finished= false;

finished_loading= function(modulename) {
    if(loading_finished)
        return;
    loading_status[modulename]= true;
    var nloaded= 0;
    for(var mname in loading_status) {
        if(loading_status.hasOwnProperty(mname)) 
            if(loading_status[mname] === true)
                nloaded += 1;
    }
    if(nloaded < 3)
        return;
    loading_finished= true;
	document.getElementById('loadingdiv').style.opacity= "0";
	window.setTimeout(function() {document.getElementById('loadingdiv').style.display= "none";}, 500)
}

processCommands= function(pageid, cmds) {
	explorerProcessCommands(pageid, cmds);
	stakingProcessCommands(pageid, cmds);
}

initPages= function() {
	explorerInit();
	walletInit();
	// stakingInit();
}

JsonRPCRequest = function(resource, data, completion_callback, error_callback) {
	var data = JSON.stringify({
		"jsonrpc": "2.0",
		"method": resource,
		"params": data,
		"id": 0
	  });

	  var xhr = new XMLHttpRequest();
	  xhr.withCredentials = true;

	  console.log(resource)
	  
	  xhr.addEventListener("readystatechange", function() {
		if(this.readyState === 4) {
			if(this.status === 200) {
				try {
					var response= JSON.parse(this.responseText);
				} catch(e) {
					error_callback('JSON.parse error: ' + String(e), this) ;
				}
				if ("error" in response) {
					error_callback(response.error, this) ;
				}
				else {
					completion_callback(response.result, this);
				}
			}
			else {
				error_callback('XMLHttpRequest error: ' + String(this.statusText), this);  
			}
		}
	  });
	  
	//   xhr.open("POST", "https://test.massa.net/api/v2");
	  xhr.open("POST", "https://labnet.massa.net/api/v2");
	  xhr.setRequestHeader("Content-Type", "application/json");
	  
	  xhr.send(data);
	  return xhr
}

RESTRequest= function(method, resource, data, completion_callback, error_callback) {
	var xhr= new XMLHttpRequest();
	// var url= "https://test.massa.net/api/v2/"+resource;
	var url= "https://labnet.massa.net/api/v2/"+resource;
	console.log(url)

	xhr.open(method, url, true);
	if(method == "POST") {
		xhr.setRequestHeader("Content-Type", "application/json");
	}
	else {
		xhr.setRequestHeader('Accept','text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
		if(data != null)
			xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
}

	function onreadystatechange()
	{
		if(this.readyState === 4) {
			if(this.status === 200) {
				try {
					var response= JSON.parse(this.responseText);
				} catch(e) {
					error_callback('JSON.parse error: ' + String(e), this) ;
				}
				completion_callback(response, this);
			}
			else {
				error_callback('XMLHttpRequest error: ' + String(this.statusText), this);  
			}
		}
	};
	xhr.onreadystatechange= onreadystatechange;
	if(data != null)
		xhr.send(data);
	else
		xhr.send();
	return xhr;
}

WSSClose= function(ws) {
	if(ws == null)
		return null;
	//if(!(ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING))
	ws.close();
	//delete ws;
	return null;
}

WSSConnect= function(resource, open_callback, message_callback, close_callback, error_callback) {
	var reco_timeout= false;
	if(!("WebSocket" in window)) {
		error_callback(null, 'Browser incompatible with websockets');
		return null;
	}

	var ws= new WebSocket("wss://"+window.location.hostname+"/WSSAPI/" + resource);
	
	function onopen() {
		open_callback(this);
	};
	ws.onopen= onopen;
	
	function onmessage(evt)
	{
		var msg= null;
		try {
			msg= JSON.parse(evt.data);
		} catch(error) {
			error_callback(this, 'Cannot parse JSON messsage');
		}
		message_callback(this, msg);
	};
	ws.onmessage= onmessage;
	
	function onclose(evt)
	{
		close_callback(evt.reason);
	};
	ws.onclose= onclose;
	
	function onerror(err)
	{
		WSSClose(this);
	};
	ws.onerror= onerror;
	
	return ws;
}


openPage= function(selid) {
	var splt= selid.split('?');
	var pageparts= splt[0].split('_');
	var pageid= pageparts[0];
	if(!pages.includes(pageid)) { pageid= defaultpage; }
	
	pages.forEach((id, idx, array) => {
		var lnkid= id+'_link';
		var pgid= id+'_page';
		document.getElementById(lnkid).classList.remove('navselected');
		if(id == pageid) {
			document.getElementById(pgid).style.display= 'inline';
			document.getElementById(lnkid).classList.add('navselected');
		}
		else {
			document.getElementById(pgid).style.display= 'none';
		}
	});
	if(pageparts[1]) {
		var anchor= document.getElementById(pageparts.join('_'));
		if(anchor) { anchor.scrollIntoView(); }
	}
	var cmds= {};
	if(splt[1]) {
		var fusedcmd= splt[1];
		var cmdlist= fusedcmd.split('&');
		for(var i= 0 ; i < cmdlist.length ; i++) {
			var tmpsplit= cmdlist[i].split('=');
			var paramname= '';
			var paramvalue= '';
			if(tmpsplit[0]) {
				paramname= String(tmpsplit[0]);
			}
			else {
				continue;
			}
			if(tmpsplit[1]) {
				paramvalue= decodeURIComponent(tmpsplit[1]);
			}
			cmds[paramname]= String(paramvalue);
		}
	}
	processCommands(pageid, cmds);
}

location_change= function() {
	var hsh= location.hash;
	if(hsh) {
		if(hsh[0] == '#') { hsh= hsh.substr(1); }
		openPage(hsh)
	}
	else {
		openPage(defaultpage);
	}
}

openhash= function(newhash) {
	if(newhash == location.hash) {
		location_change()
	} else {
		location.hash= newhash;
	}
}

initNav= function() {
	window.addEventListener("hashchange", location_change);
	location_change();
}

loaded= function() {
	initNav();
	initPages();
	
	/*
	var w= WSSConnect('lol', function(ws) {
		alert('open'+ws);
	}, function(ws, msg) {
		alert('msg' + msg);
	}, function(reason) {
		alert('close'+reason);
	}, function(ws, reason) {
		alert('error'+ws+reason);
	});	
	*/
    finished_loading('main_init');
}


const copyToClipboard = function(txt) {
    const txtarea= document.createElement('textarea');
    txtarea.setAttribute('readonly', true);
    txtarea.style.position = 'absolute';
    txtarea.style.opacity= '0';
    txtarea.style.display= 'block';
    txtarea.style.width= '0';
    txtarea.style.left= '-10px';
    txtarea.value= txt;
    document.body.appendChild(txtarea);
    var selranges= [];
    var cursel= document.getSelection();
    for(var i= 0; i < cursel.rangeCount ; i++)
        selranges.push(cursel.getRangeAt(i));
    cursel.removeAllRanges();
    txtarea.select();
    document.execCommand('copy');
    document.body.removeChild(txtarea);
    cursel.removeAllRanges();
    for(var i= 0; i < selranges.length ; i++)
        cursel.addRange(selranges[i]);
};

window.addEventListener("load", loaded); 

