requestsRemaining = 0
requestsSuccess = 0
explorerProcessCommands= function(pageid, cmds) {
    if(pageid == 'explorer') {
        explorerGetViewInterval();
        explorerUpdateInfo(false);
    }
    else {
        if(explorerGetViewIntervalTimeout != null) { clearTimeout(explorerGetViewIntervalTimeout); explorerGetViewIntervalTimeout=null; }
        if(explorerGetViewIntervalXhr != null) { var tmp=explorerGetViewIntervalXhr; explorerGetViewIntervalXhr=null; tmp.abort(); }
        if(explorerUpdateInfoTimeout != null) { clearTimeout(explorerUpdateInfoTimeout); explorerUpdateInfoTimeout=null; }
        if(explorerUpdateInfoXhr != null) { var tmp=explorerUpdateInfoXhr; explorerUpdateInfoXhr=null; tmp.abort(); }
    }
    
    if('explore' in cmds) {
        explorerViewSelCenter= !('nocenter' in cmds)
		explorerSearch(cmds['explore'])
        // explorerSearchBlock(cmds['explore'])
		// explorerSearchTransaction(cmds['explore'])
		// explorerSearchAddress(cmds['explore'])
    }
    else
        explorerSearchClear();
}

nthreads = null
explorerGenesisTimestamp = null
explorerT0 = null
explorerGetConfig= function() {
	function onresponse(resJson, xhr) {
		nthreads = resJson.config.thread_count
		explorerGenesisTimestamp = resJson.config.genesis_timestamp
		explorerT0 = resJson.config.t0
	}
	function onerror(error, xhr) {
		if(explorerGetViewIntervalXhr != null) { // yeah, otherwise we actually wanted it to die
			explorerGetViewIntervalXhr= null;
			explorerGetViewIntervalTimeout= setTimeout(explorerGetConfig, 10000)
		}
	}
	data = []
	JsonRPCRequest('get_status', data, onresponse, onerror);
}
explorerGetConfig()

explorerViewDragStartEndTime= null
explorerViewDragStartPos= null
explorerViewDragging= false
explorerViewCancelClick= false
explorerInit= function() {
	var explorer_searchform= document.getElementById('explorer_searchform');
	explorer_searchform.addEventListener("submit", function(evt) {
		if(evt.preventDefault) evt.preventDefault();
		explorersearch= document.getElementById('explorersearch');
		openhash('#explorer?explore=' + encodeURIComponent(explorersearch.value));
		return false;
	})
	
	var scrollcb= document.getElementById('explorer_livescroll');
	scrollcb.addEventListener('change', function() {
		explorerViewScrolling = this.checked;
		if(explorerViewScrolling) {
			explorerViewEnd= null;
			explorerViewKeypointEnd= null
			explorerViewTimestampAtKeypointEnd= null
			explorerViewLastEnd= null
			explorerViewTimestampAtLastEnd= null
			explorerViewLastBlockTimestamp= null
			explorerViewTimestampAtLastBlock= null
			explorerViewLastBlockId= null
			explorerGetViewInterval();
		}
	});
	explorerViewScrolling = scrollcb.checked;

	var canv= document.getElementById('explorer_livecanvas')
	var canvDragStartFunc= function(evt) {
		if(explorerViewDragging || explorerViewEnd == null || explorerViewDragStartPos != null)
			return;
		explorerViewCancelClick= false
		var xpos= -1
		if(evt.offsetX != undefined)
			xpos= evt.offsetX
		else
			xpos= evt.touches[0].clientX
		explorerViewDragStartPos= xpos/canv.width
		explorerViewDragStartEndTime= explorerViewEnd
		//evt.preventDefault();
	}
	var canvDragMoveFunc= function(evt) {
		if(explorerViewEnd == null || explorerViewDragStartPos == null)
			return;
		var xpos= -1
		if(evt.offsetX != undefined)
			xpos= evt.offsetX
		else
			xpos= evt.touches[0].clientX
		var movedPos= xpos/canv.width - explorerViewDragStartPos
		if (Math.abs(movedPos) > 0.1) { //drag started
			if(!explorerViewDragging) {
				explorerViewDragging= true;
				explorerGetViewInterval()
			}
			scrollcb.checked= false;
			explorerViewScrolling= false;
			explorerViewCancelClick= true
		}
		if(!explorerViewDragging)
			return;
		//evt.preventDefault();
		explorerViewEnd= explorerViewDragStartEndTime - movedPos*explorerViewTimespan;
	}
	var canvDragStopFunc= function(evt) {
		explorerViewDragging= false
		explorerViewDragStartPos= null
		explorerViewDragStartEndTime= null
	}
	var canvClick= function(evt) {
		if(explorerViewCancelClick) {
			explorerViewCancelClick= false
			return
		}
		if(explorerViewEnd == null || explorerGetViewIntervalResult == null)
			return
		explorerViewUpdate(null, false)
		var clickX= (evt.offsetX/canv.width);
		var clickY= (evt.offsetY/canv.height);
		var xytolerance= 0.05
		var xtolerance= (xytolerance * Math.min(canv.width,canv.height))/canv.width
		var ytolerance= (xytolerance * Math.min(canv.width,canv.height))/canv.height
		var mindist= -1
		var mini= null
		for(var i= 0 ; i < explorerGetViewIntervalResult.length ; i++) {
			var blockx= explorerGetViewIntervalResult[i].drawX
			var blocky= explorerGetViewIntervalResult[i].drawY
			var blockw= explorerGetViewIntervalResult[i].drawW
			var blockh= explorerGetViewIntervalResult[i].drawH
			
			if(clickX<blockx-xtolerance-blockw/2||clickX>blockx+xtolerance+blockw/2||clickY<blocky-ytolerance-blockh/2||clickY>blocky+ytolerance+blockh/2)
				continue
			var dist= (blockx-clickX)*(blockx-clickX) + (blocky-clickY)*(blocky-clickY)
			if(mindist < 0 || dist < mindist) {
				mindist= dist;
				mini= i;
			}
		}
		if(mini != null)
			openhash('#explorer?explore=' + encodeURIComponent(explorerGetViewIntervalResult[mini].id) + '&nocenter');
		else
			openhash('#explorer');
	}
	
	canv.addEventListener('touchstart', canvDragStartFunc)
	canv.addEventListener('mousedown', canvDragStartFunc)
	canv.addEventListener('touchmove', canvDragMoveFunc)
	canv.addEventListener('mousemove', canvDragMoveFunc)
	canv.addEventListener('mouseup', canvDragStopFunc)
	canv.addEventListener('touchend', canvDragStopFunc)
	canv.addEventListener('touchcancel', canvDragStopFunc)
	canv.addEventListener('touchleave', canvDragStopFunc)
	canv.addEventListener('mouseout', canvDragStopFunc)
	canv.addEventListener('click', canvClick)
	
	explorerUpdateInfo();
	explorerGetViewInterval();
	window.requestAnimationFrame(explorerViewUpdate)
	finished_loading('explorer_init');
}

var explorerSearchTimeout = null
explorerSearch = function(what, first=true) {
	what = what.trim();
	if(what == '') { explorerSearchClear(); return; }
	if(explorerSearchTimeout != null) { clearTimeout(explorerSearchTimeout); explorerSearchTimeout=null; }
	var statusdiv= document.getElementById('explorerSearchStatus');
	var div_block= document.getElementById('explorerBlockSearchResult');
	var div_op= document.getElementById('explorerTransactionSearchResult');
	var div_address= document.getElementById('explorerAddressSearchResult');
	
	if(first) {
		if(div_block) div_block.innerHTML= '';
		if(div_op) div_op.innerHTML= '';
		if(div_address) div_address.innerHTML= '';
		explorersearch= document.getElementById('explorersearch');
		if(explorersearch) { explorersearch.value= what; }
		if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'Loading search results...'; }
	}

	if(requestsRemaining == 0){
		requestsRemaining = 3
		requestsSuccess = 0
		explorerSearchBlock(what)
		explorerSearchTransaction(what)
		explorerSearchAddress(what)
		explorerSearchStatus(first)
		explorerSearchTimeout = setTimeout(explorerSearch, 20000, what, false)
	}
}

var explorerSearchStatusTimeout = null
explorerSearchStatus = function(first) {
	if(explorerSearchStatusTimeout != null) { clearTimeout(explorerSearchStatusTimeout); explorerSearchStatusTimeout=null; }
	var statusdiv= document.getElementById('explorerSearchStatus');
	
	// If there are no requests remaining we remove the loading status
	if(requestsRemaining == 0){
		if(requestsSuccess > 0) {
			if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }
		}
		else
			if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'No block, operation or address found.'; }
	}
	else {
		// Check search status in 500ms
		explorerSearchStatusTimeout = setTimeout(explorerSearchStatus, 200, false)
	}
}

var explorerSearchBlockXhr= null
// var explorerSearchBlockTimeout= null
explorerSearchBlock= function(what) {
	// if(what == '') { explorerSearchClear(); return; }
	// if(explorerSearchBlockTimeout != null) { clearTimeout(explorerSearchBlockTimeout); explorerSearchBlockTimeout=null; }
	if(explorerSearchBlockXhr != null) { var tmp=explorerSearchBlockXhr; explorerSearchBlockXhr=null; tmp.abort(); }
	var div= document.getElementById('explorerBlockSearchResult');
	// var statusdiv= document.getElementById('explorerSearchStatus');
	
	explorerViewSelId= null
	
	// if(first) {
	// 	if(div) div.innerHTML= '';
	// 	explorersearch= document.getElementById('explorersearch');
	// 	if(explorersearch) { explorersearch.value= what; }
	// 	if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'Loading search results...'; }
	// }

	function onresponse(resJson, xhr) {
		requestsRemaining -= 1
		requestsSuccess += 1
		explorerViewSelId= what
		resJson['what'] = what

		if (resJson[0].content != null) {
			explorerSetBlockSearchTable(resJson[0]);
			// var statusdiv= document.getElementById('explorerSearchStatus');
			// if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }

			explorerSearchBlockXhr= null;
			// explorerSearchBlockTimeout= setTimeout(explorerSearchBlock, 10000, what, false)
			
			if(explorerViewSelCenter) {
				explorerViewEnd = (explorerGenesisTimestamp + (resJson.content.block.header.content.slot.period + resJson.content.block.header.content.slot.thread/nthreads) * explorerT0) / 1000 + explorerViewTimespan/2;
				document.getElementById('explorer_livescroll').checked = false;
				explorerViewScrolling= false;
			}

			explorerViewSelCenter= false
		}
	}
	function onerror(error, xhr) {
		requestsRemaining -= 1
		if(explorerSearchBlockXhr != null) { 
			explorerSearchBlockXhr= null;
			// var statusdiv= document.getElementById('explorerSearchStatus');
			// if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading search data. Retrying...'; }
			// explorerSearchBlockTimeout= setTimeout(explorerSearchBlock, 1000, what, false)
		}
			
	}
	data = [[what]]
	explorerSearchBlockXhr = JsonRPCRequest('get_blocks', data, onresponse, onerror);
}

var explorerSearchTransactionXhr= null
// var explorerSearchTransactionTimeout= null
explorerSearchTransaction= function(what) {
	// if(explorerSearchTransactionTimeout != null) { clearTimeout(explorerSearchTransactionTimeout); explorerSearchTransactionTimeout=null; }
	if(explorerSearchTransactionXhr != null) { var tmp=explorerSearchTransactionXhr; explorerSearchTransactionXhr=null; tmp.abort(); }
	
	// var div= document.getElementById('explorerSearchResult');
	// var statusdiv= document.getElementById('explorerSearchStatus');
	
	// if(first) {
	// 	if(div) div.innerHTML= '';
	// 	explorersearch= document.getElementById('explorersearch');
	// 	if(explorersearch) { explorersearch.value= what; }
	// 	if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'Loading search results...'; }
	// }

	function onresponse(resJson, xhr) {
		requestsRemaining -= 1
		requestsSuccess += 1
		resJson['what'] = what

		if(resJson[0]) {
			explorerSetTransactionSearchTable(resJson);
			var statusdiv= document.getElementById('explorerSearchStatus');
			if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }

			explorerSearchTransactionXhr= null;
			// explorerSearchTransactionTimeout= setTimeout(explorerSearchTransaction, 10000, what, false)

			explorerViewSelCenter= false
		}
	}
	function onerror(error, xhr) {
		requestsRemaining -= 1
		if(explorerSearchTransactionXhr != null) { 
			explorerSearchTransactionXhr= null;
			// var statusdiv= document.getElementById('explorerSearchStatus');
			// if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading search data. Retrying...'; }
			// explorerSearchTransactionTimeout= setTimeout(explorerSearchTransaction, 1000, what, false)
		}
		else
			explorerSearchAddress(what)
	}
	data = [[what]]
	explorerSearchTransactionXhr = JsonRPCRequest('get_operations', data, onresponse, onerror);
}

var explorerSearchAddressXhr= null
// var explorerSearchAddressTimeout= null
explorerSearchAddress= function(what) {
	// if(explorerSearchAddressTimeout != null) { clearTimeout(explorerSearchAddressTimeout); explorerSearchAddressTimeout=null; }
	if(explorerSearchAddressXhr != null) { var tmp=explorerSearchAddressXhr; explorerSearchAddressXhr=null; tmp.abort(); }
	
	// var div= document.getElementById('explorerSearchResult');
	// var statusdiv= document.getElementById('explorerSearchStatus');
	
	// if(first) {
	// 	if(div) div.innerHTML= '';
	// 	explorersearch= document.getElementById('explorersearch');
	// 	if(explorersearch) { explorersearch.value= what; }
	// 	if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'Loading search results...'; }
	// }

	function onresponse(resJson, xhr) {
		resJson['what'] = what
		if (resJson[0].candidate_balance != 0 || resJson[0].final_balance !=0 || resJson[0].locked_balance != 0 || resJson[0].final_roll_count !=0 || resJson[0].cycle_infos.active_rolls || resJson[0].candidate_roll_count != 0) {

			explorerSearchAddressXhr= null;
			// explorerSearchAddressTimeout= setTimeout(explorerSearchAddress, 10000, what, false)

			explorerViewSelCenter= false
			requestsRemaining -= 1
			requestsSuccess += 1
			// explorerSetAddressOperations(tab, resJson)
			explorerSetAddressSearchTable(resJson)
			
			var statusdiv= document.getElementById('explorerSearchStatus');
			if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }
		}
		else
			requestsRemaining -= 1
	}
	function onerror(error, xhr) {
		requestsRemaining -= 1
		if(explorerSearchAddressXhr != null) { 
			explorerSearchAddressXhr= null;
			// var statusdiv= document.getElementById('explorerSearchStatus');
			// if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading search data. Retrying...'; }
			// explorerSearchAddressTimeout= setTimeout(explorerSearchAddress, 1000, what, false)
		}
	}
	data = [[what]]
	explorerSearchAddressXhr = JsonRPCRequest('get_addresses', data, onresponse, onerror);
}

explorerSearchClear= function() {
	explorerSearchResult= null;
	explorersearch= document.getElementById('explorersearch');
	if(explorersearch) { explorersearch.value= ''; }
	if(explorerSearchTimeout != null) { clearTimeout(explorerSearchTimeout); explorerSearchTimeout=null; }
	// if(explorerSearchBlockTimeout != null) { clearTimeout(explorerSearchBlockTimeout); explorerSearchBlockTimeout=null; }
	if(explorerSearchBlockXhr != null) { var tmp=explorerSearchBlockXhr; explorerSearchBlockXhr=null; tmp.abort(); }
	// if(explorerSearchTransactionTimeout != null) { clearTimeout(explorerSearchTransactionTimeout); explorerSearchTransactionTimeout=null; }
	if(explorerSearchTransactionXhr != null) { var tmp=explorerSearchTransactionXhr; explorerSearchTransactionXhr=null; tmp.abort(); }
	// if(explorerSearchAddressTimeout != null) { clearTimeout(explorerSearchAddressTimeout); explorerSearchAddressTimeout=null; }
	if(explorerSearchAddressXhr != null) { var tmp=explorerSearchAddressXhr; explorerSearchAddressXhr=null; tmp.abort(); }
	// if(addressOperationsSearchTimeout != null) { clearTimeout(addressOperationsSearchTimeout); addressOperationsSearchTimeout=null; }
	// if(addressOperationsSearchXhr != null) { var tmp=addressOperationsSearchXhr; addressOperationsSearchXhr=null; tmp.abort(); }
	var div= document.getElementById('explorerSearchResult');
	if(div) div.innerHTML= '';
	var statusdiv= document.getElementById('explorerSearchStatus');
	if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }
	explorerViewSelId= null;
	explorerViewSelCenter= false;
}

explorerBlockSearchResult= null
explorerSetBlockSearchTable= function(jsondata) {
	explorerBlockSearchResult= jsondata
	var div= document.getElementById('explorerBlockSearchResult');
	if(!div) return;
	div.innerHTML= '';
	
	var tab= document.createElement('TABLE');
	div.appendChild(tab);
	var htr= document.createElement('TR');
	tab.appendChild(htr);
	var hth= document.createElement('TH');
	htr.appendChild(hth);
	hth.colSpan= 2;
	hth.classList.add('ellipsis');

	var addheader= function(h) {
		hth.appendChild(document.createTextNode(String(h)));
	}
	var addrow = function(field, content) {
		var tr = document.createElement('TR');
		tab.appendChild(tr);
		var td_field= document.createElement('TD');
		td_field.classList.add('smalltd');
		tr.appendChild(td_field);
		td_field.appendChild(document.createTextNode(String(field)));
		var td_content= document.createElement('TD');
		td_content.classList.add('ellipsis');
		tr.appendChild(td_content);
		if(content != null)
			td_content.appendChild(document.createTextNode(String(content)));
		return td_content
	}
	
	var createSearchLink= function(target) {
		a= document.createElement('A');
		a.classList.add('keylink');
		a.href= "#explorer?explore=" + encodeURIComponent(target);
		a.appendChild(document.createTextNode(target))
		return a;
	}

	addheader('Block ' + String(jsondata['id']));
	console.log(jsondata)
	if (jsondata.content == null) {
		var tr = document.createElement('TR');
		tab.appendChild(tr);
		var td_field= document.createElement('TD');
		td_field.classList.add('smalltd');
		tr.appendChild(td_field);
		td_field.appendChild(document.createTextNode('Block not found'));
	}
	else {
		jsondata = jsondata.content
		if (jsondata.is_final) {
			addrow('Status', 'Final')
		}
		else if (jsondata.is_stale) {
			addrow('Status', 'Stale')
		}
		else if (!jsondata.is_final) {
			addrow('Status', 'Active')
		}
		var tdc = addrow('Creator', null)
		tdc.appendChild(createSearchLink(jsondata.block.header.content_creator_address))
		addrow('Thread', jsondata.block.header.content.slot['thread'])
		addrow('Period', jsondata.block.header.content.slot['period'])
		addrow('Signature', jsondata.block.header['signature'])
		addrow('Endorsement Count', jsondata.block.header.content.endorsements.length)

		var operations = jsondata.block.operations;
		console.log(operations)
		addrow('Op. Count', operations.length)
		for(var i= 0 ; i < operations.length ; i++) {
				var tdc = addrow("Op. " + i, null)
				tdc.appendChild(createSearchLink(String(operations[i])));
		}
		
		for (var i=0; i<jsondata.block.header.content.endorsements.length; i++) {
			// TODO: Move to endorsement id when endpoint is present.
			var endorser_address = jsondata.block.header.content.endorsements[i].content_creator_address;
			var tdc = addrow('Endorsement', null)
			tdc.appendChild(createSearchLink(endorser_address));
		}

		parentIds = jsondata.block.header.content['parents'];
		for(var i= 0 ; i < parentIds.length ; i++) {
			var tdc= addrow('Parent (thread ' + i + ')', null)
			tdc.appendChild(createSearchLink(String(parentIds[i])));
		}
	}
}

explorerTransactionSearchResult= null
explorerSetTransactionSearchTable= function(jsondata) {
	explorerTransactionSearchResult= jsondata
	var div= document.getElementById('explorerTransactionSearchResult');
	if(!div) return;

	div.innerHTML= '';
	
	var tab= document.createElement('TABLE');
	div.appendChild(tab);
	var htr= document.createElement('TR');
	tab.appendChild(htr);
	var hth= document.createElement('TH');
	htr.appendChild(hth);
	hth.colSpan= 2;
	hth.classList.add('ellipsis');

	var addheader= function(h) {
		hth.appendChild(document.createTextNode(String(h)));
	}
	var addrow = function(field, content) {
		var tr = document.createElement('TR');
		tab.appendChild(tr);
		var td_field= document.createElement('TD');
		td_field.classList.add('smalltd');
		tr.appendChild(td_field);
		td_field.appendChild(document.createTextNode(String(field)));
		var td_content= document.createElement('TD');
		td_content.classList.add('ellipsis');
		tr.appendChild(td_content);
		if(content != null)
			td_content.appendChild(document.createTextNode(String(content)));
		return td_content
	}
	
	var createSearchLink= function(target) {
		a= document.createElement('A');
		a.classList.add('keylink');
		a.href= "#explorer?explore=" + encodeURIComponent(target);
		a.appendChild(document.createTextNode(target))
		return a;
	}
	
	addheader('Operation ' + String(jsondata['what']))
	var operation_type = Object.keys(jsondata[0].operation.content.op)[0]
	addrow('Operation type', operation_type)
	if(operation_type == "RollBuy") {
		var roll_count = jsondata[0].operation.content.op.RollBuy.roll_count
		addrow('Roll Count', roll_count);
	}
	var transactionInBlocks = jsondata[0].in_blocks;
	for (var i = 0 ; i <transactionInBlocks.length; i++) {
		var tdc = addrow('In block', null);
		tdc.appendChild(createSearchLink(transactionInBlocks[i]));
	}
	if(jsondata[0].is_final) {
		addrow('Finality state', 'Final');
	}
	else {
		addrow('Finality state', 'Pending');
	}
	var addr = String(jsondata[0].operation.content_creator_address);
	var tdc= addrow('From', null);
	tdc.appendChild(createSearchLink(addr));
	if(operation_type=="Transaction") {
		var tdc= addrow('To', null);
		tdc.appendChild(createSearchLink(String(jsondata[0].operation.content.op.Transaction.recipient_address)));
		var value = new Decimal(jsondata[0].operation.content.op.Transaction.amount)
		addrow('Value', value);
		var fee = new Decimal(jsondata[0].operation.content.fee)
		addrow('Fee', fee);
	}
	addrow('In pool', jsondata[0].in_pool);
	console.log(addr);
	addrow('Thread', xbqcrypto.get_address_thread(addr));
}


explorerAddressSearchResult= null
explorerSetAddressSearchTable= function(jsondata) {
	console.log(jsondata)
	explorerAddressSearchResult= jsondata
	var div= document.getElementById('explorerAddressSearchResult');
	if(!div) return;
	
	div.innerHTML= '';
	
	var tab= document.createElement('TABLE');
	div.appendChild(tab);
	var htr= document.createElement('TR');
	tab.appendChild(htr);
	var hth= document.createElement('TH');
	htr.appendChild(hth);
	hth.colSpan= 2;
	hth.classList.add('ellipsis');

	var addheader= function(h) {
		hth.appendChild(document.createTextNode(String(h)));
	}
	var addrow = function(field, content) {
		var tr = document.createElement('TR');
		tab.appendChild(tr);
		var td_field= document.createElement('TD');
		td_field.classList.add('smalltd');
		tr.appendChild(td_field);
		td_field.appendChild(document.createTextNode(String(field)));
		var td_content= document.createElement('TD');
		td_content.classList.add('ellipsis');
		tr.appendChild(td_content);
		if(content != null)
			td_content.appendChild(document.createTextNode(String(content)));
		return td_content
	}
	
	var createSearchLink= function(target) {
		a= document.createElement('A');
		a.classList.add('keylink');
		a.href= "#explorer?explore=" + encodeURIComponent(target);
		a.appendChild(document.createTextNode(target))
		return a;
	}

	addheader('Address ' + String(jsondata['what']));
	
	var final_balance = new Decimal(jsondata[0].final_balance)
	addrow('Final balance', final_balance);
	var candidate_balance = new Decimal(jsondata[0].candidate_balance)
	addrow('Candidate balance', candidate_balance);
	// var locked_balance = new Decimal(jsondata[0].ledger_info.locked_balance)
	// addrow('Locked balance', locked_balance);
	var thread = xbqcrypto.get_address_thread(jsondata['what'])
	addrow('Thread', thread);

	var final_rolls = jsondata[0].final_roll_count
	addrow('Final rolls', final_rolls);
	var active_rolls = jsondata[0].cycle_infos[jsondata[0].cycle_infos.length - 1].active_rolls
	addrow('Active rolls', active_rolls);
	var candidate_rolls = jsondata[0].candidate_roll_count
	addrow('Candidate rolls', candidate_rolls);

	for(var i = 0 ; i < jsondata[0].created_endorsements.length ; i++) {
		var tdc = addrow('Endorsements', null);
		tdc.appendChild(createSearchLink(String(jsondata[0].created_endorsements[i])));
	}

	for (var i = 0 ; i < jsondata[0].created_operations.length; i++) {
		var tdc = addrow('Operation', null);
		tdc.appendChild(createSearchLink(String(jsondata[0].created_operations[i])));
	}

	for(var i = 0 ; i < jsondata[0].created_blocks.length ; i++) {
		var tdc = addrow('Block', null);
		tdc.appendChild(createSearchLink(String(jsondata[0].created_blocks[i])));
	}
}

explorerSetAddressOperations = function(tab, jsondata) {
	var addrow = function(field, content) {
		var tr = document.createElement('TR');
		tab.appendChild(tr);
		var td_field= document.createElement('TD');
		td_field.classList.add('smalltd');
		tr.appendChild(td_field);
		td_field.appendChild(document.createTextNode(String(field)));
		var td_content= document.createElement('TD');
		td_content.classList.add('ellipsis');
		tr.appendChild(td_content);
		if(content != null)
			td_content.appendChild(document.createTextNode(String(content)));
		return td_content
	}

	var createSearchLink= function(target) {
		a= document.createElement('A');
		a.classList.add('keylink');
		a.href= "#explorer?explore=" + encodeURIComponent(target);
		a.appendChild(document.createTextNode(target))
		return a;
	}

	for (const [key, value] of Object.entries(jsondata)) {
		console.log(key, value);
		var tdc = addrow('Transaction', null);
		tdc.appendChild(createSearchLink(String(key)));
	}
}

latest_period = null
var explorerUpdateInfoXhr= null
var explorerUpdateInfoTimeout= null
explorerUpdateInfo= function(first=true) {
	if(explorerUpdateInfoTimeout != null) { clearTimeout(explorerUpdateInfoTimeout); explorerUpdateInfoTimeout=null; }
	if(explorerUpdateInfoXhr != null) { var tmp=explorerUpdateInfoXhr; explorerUpdateInfoXhr=null; tmp.abort(); }
	var statusdiv= document.getElementById('explorerInfoStatus');
	if(first && statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'Loading infos...'; }

	function onresponse(resJson, xhr) {
		// explorerStakingUpdateInfos(resJson)
		var statusdiv= document.getElementById('explorerInfoStatus');
		if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }
		latest_period = resJson.last_period
		explorerSetInfo(resJson);
		explorerUpdateInfoXhr= null;
		explorerUpdateInfoTimeout= setTimeout(explorerUpdateInfo, 10000, false)
	}
	function onerror(error, xhr) {
		if(explorerUpdateInfoXhr != null) { // yeah, otherwise we actually wanted it to die
			explorerUpdateInfoXhr= null;
			var statusdiv= document.getElementById('explorerInfoStatus');
			if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading infos. Retrying...'; }
			explorerUpdateInfoTimeout= setTimeout(explorerUpdateInfo, 10000, false)
		}
	}
	explorerUpdateInfoXhr= RESTRequest("GET", 'info', null, onresponse, onerror);
}

explorerSetInfo= function(data) {
	var div= document.getElementById('explorerInfo');
	if(!div) return;

	var date = new Date(explorerGenesisTimestamp);
	var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  	var year = date.getFullYear();
  	var month = months[date.getMonth()];
  	var day = date.getDate();
	var hours = date.getHours();
	var minutes = "0" + date.getMinutes();
	var seconds = "0" + date.getSeconds();
	var formattedTime = day + ' ' + month + ' ' + year + ', ' + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);

	div.innerHTML = '<span>\
	Testnet version: <b>' + data.version + '</b><br>\
	Start time: <b>' + formattedTime + '</b><br>\
	Cycle: <b>' + data.current_cycle + '</b>, Period: <b>' + data.last_period + '</b><br>\
	Transaction Throughput: <b>' + Math.round((data.final_operation_count / data.timespan * 1000 + Number.EPSILON)) + ' tx/s' + '</b><br>\
	Block Throughput: <b>' + Math.round((data.final_block_count / data.timespan * 1000 + Number.EPSILON) * 1000) / 1000 + ' b/s' + '</b><br>\
	Number of Cliques: <b>' + data.clique_count + '</b><br>\
	Number of Stakers: <b>' + data.n_stakers + '</b><br>\
	</span>';

	finished_loading('wallet_info');
}

var explorerViewTimespan= 120
var explorerViewScrolling= true
var explorerViewEnd= null
var explorerViewKeypointEnd= null
var explorerViewTimestampAtKeypointEnd= null
var explorerViewLastEnd= null
var explorerViewTimestampAtLastEnd= null
var explorerGetViewIntervalXhr= null
var explorerGetViewIntervalTimeout= null
var explorerViewIntervalBlocks= []
var explorerCurViewTimestamp= null
var explorerViewTimePad= explorerViewTimespan/10.0
var explorerViewSelId= null
var explorerViewLastBlockTimestamp= null
var explorerViewTimestampAtLastBlock= null
var explorerViewLastBlockId= null
var explorerViewSelCenter= false
var lastblc = null
var explorerGetViewIntervalResult = null
explorerGetViewInterval= function() {
	if(explorerGetViewIntervalTimeout != null) { clearTimeout(explorerGetViewIntervalTimeout); explorerGetViewIntervalTimeout=null; }
	if(explorerGetViewIntervalXhr != null) { var tmp=explorerGetViewIntervalXhr; explorerGetViewIntervalXhr=null; tmp.abort(); }
	
	function onresponse(resJson, xhr) {
		if (resJson.hasOwnProperty('timeEnd')) {
			explorerGetViewIntervalResult = resJson.blocks
		}
		else {
			explorerGetViewIntervalResult = resJson
		}
		explorerUpdateInfoXhr= null;
		if(explorerGetViewIntervalTimeout != null) { clearTimeout(explorerGetViewIntervalTimeout); explorerGetViewIntervalTimeout=null; }
		var timeoutVal= 1000; // update less often if we are looking in the distant past
		if(explorerViewDragging)
			timeoutVal= 1000; 
		explorerGetViewIntervalTimeout= setTimeout(explorerGetViewInterval, timeoutVal)

		if (explorerGetViewIntervalResult.length > 0) {
			var blocks_per_slot = {};
			for(var i = 0 ; i < explorerGetViewIntervalResult.length ; i++) {
				var block_thread = explorerGetViewIntervalResult[i].slot.thread
				var block_period = explorerGetViewIntervalResult[i].slot.period
				if (blocks_per_slot.hasOwnProperty(block_thread+block_period*nthreads)) {
					blocks_per_slot[block_thread+block_period*nthreads] += 1
				}
				else {
					blocks_per_slot[block_thread+block_period*nthreads] = 0
				}
				explorerGetViewIntervalResult[i].timestamp = (explorerGenesisTimestamp + (block_period + block_thread/nthreads) * explorerT0) / 1000 - blocks_per_slot[block_thread+block_period*nthreads]*blocksymbolsize*explorerViewTimespan/canvw*1.2
			}

			if(explorerViewScrolling && explorerGetViewIntervalResult.length > 0) {

				lastblc = explorerGetViewIntervalResult[explorerGetViewIntervalResult.length-1]
	            lastblc.timestampParents = []

	            for (var i=0 ; i < nthreads ; i++) {
            		parentTimestamp = null
            		for (var j=0 ; j < explorerGetViewIntervalResult.length ; j++) {
  						if (lastblc.parents[i] == explorerGetViewIntervalResult[j].id) {
							lastblc.timestampParents.push(explorerGetViewIntervalResult[j].timestamp)
						}
					}
	            }
				
				if(explorerViewLastBlockId != lastblc.id) {
					explorerViewLastBlockTimestamp= lastblc.timestamp
					explorerViewTimestampAtLastBlock= explorerCurViewTimestamp
					explorerViewLastBlockId= lastblc.id;
				}
			}

			explorerViewLastEnd= resJson.timeEnd / 1000;
			explorerViewTimestampAtLastEnd= explorerCurViewTimestamp;
			if(explorerViewScrolling) {
				if(explorerViewKeypointEnd == null || explorerViewTimestampAtKeypointEnd == null) {
					explorerViewKeypointEnd= Date.now() / 1000
					explorerViewTimestampAtKeypointEnd= explorerCurViewTimestamp;
				}
			}
			if(explorerViewEnd == null)
				explorerViewEnd= Date.now() / 1000
		}
		else {
		    if(explorerGetViewIntervalResult != null)
		        console.log('Explorer format error.');
	    }
	    finished_loading('explorer_graph');
	}
	function onerror(error, xhr) {
		if(explorerGetViewIntervalXhr != null) { // yeah, otherwise we actually wanted it to die
			explorerGetViewIntervalXhr= null;
			explorerGetViewIntervalTimeout= setTimeout(explorerGetViewInterval, 3000)
		}
	}

	if(explorerViewEnd != null) {
		viewStart = Math.floor((explorerViewEnd - explorerViewTimespan - explorerViewTimePad) * 1000)
		viewEnd = Math.ceil((explorerViewEnd + explorerViewTimePad) * 1000)
		if(viewStart < 0) viewStart = 0
	}
	else {
		viewEnd = Date.now()
		viewStart = viewEnd - (explorerViewTimespan + explorerViewTimePad) * 1000
	}
    
    if(explorerViewScrolling) {
        explorerGetViewIntervalXhr = RESTRequest("GET", 'latest_blocks', null, onresponse, onerror);
    } else {
			// Rounding for cache
			viewStart = Math.floor(viewStart/500) * 500
			viewEnd = Math.floor(viewEnd/500) * 500
			data = {"start": viewStart,
					"end": viewEnd}
			explorerGetViewIntervalXhr = JsonRPCRequest('get_graph_interval', [data], onresponse, onerror);
    }
}

explorerAutoLine = function(ctx, fromx, fromy, tox, toy, ctlshift) {
    let limit_angle = 10  * 180 / Math.P;
    ctx.moveTo(fromx, fromy);
    let deltaX = tox-fromx;
    let deltaY = toy-fromy;
    let angle = Math.atan2(deltaY, deltaX);
    if(toy < fromy && Math.abs(Math.sin(angle)) > 0.90) {
        let dist = Math.sqrt(deltaX*deltaX + deltaY*deltaY);
        let cpx = (fromx+tox)/2 - dist/3 - ctlshift;
        let cpy = (fromy+toy)/2;
        ctx.quadraticCurveTo(cpx, cpy, tox, toy);
    } else {
	    ctx.lineTo(tox, toy);
    }
}

var blocksymbolsize = null
var canvw = null
explorerViewUpdate= function(timestamp=null, relaunch=true) {

	if (timestamp != null)
		explorerCurViewTimestamp= timestamp/1000.0;

	var canv= document.getElementById('explorer_livecanvas');
	if(!canv) {
		window.requestAnimationFrame(explorerViewUpdate)
		return;
	}
	canvw= canv.scrollWidth;
	var minch= 200, maxch= 500, tryprop= 0.3;
	var canvh= Math.round(tryprop*canvw)
	if(canvh > maxch)
		canvh= maxch;
	else if(canvh < minch)
		canvh= minch
	canv.style.height= canvh;
	canv.width= canvw;
	canv.height= canvh;
	var ctx= canv.getContext("2d");
	
	//Thread lines
	var threadys= []
	var lineyinterval= canvh/(nthreads+1)
	ctx.beginPath();
	for(var threadi= 0 ; threadi < nthreads ; threadi++) {
		var liney= (threadi+1)*lineyinterval
		ctx.moveTo(0,liney);
		ctx.lineTo(canvw,liney);
		threadys.push(liney)
	}
	ctx.lineWidth= 1;
	ctx.strokeStyle = '#DEDEFF';
	ctx.stroke()
	
	blocksymbolsize = Math.max(1,Math.min(lineyinterval-2, 30))
	
	//Dunno where we are. Don't draw anything
	if( (explorerViewScrolling && explorerViewKeypointEnd == null) || (explorerViewEnd == null) ) {
		window.requestAnimationFrame(explorerViewUpdate)
		return;
	}

	//Correct big lags
	var projectedEnd= null;
	if(explorerViewScrolling && explorerCurViewTimestamp != null) {
		explorerViewEnd= explorerViewKeypointEnd + (explorerCurViewTimestamp - explorerViewTimestampAtKeypointEnd)
		if(explorerViewLastEnd != null && explorerViewTimestampAtLastEnd != null) {
			projectedEnd= explorerViewLastEnd + (explorerCurViewTimestamp - explorerViewTimestampAtLastEnd)
			maxLag= 5.0
			if(Math.abs(projectedEnd - explorerViewEnd) > maxLag) {
				explorerViewEnd= projectedEnd;
				explorerViewTimestampAtKeypointEnd= explorerViewTimestampAtLastEnd;
				explorerViewKeypointEnd= explorerViewLastEnd;
			}
		}
	}
	
	if(explorerViewScrolling && explorerViewEnd != null)
		explorerViewEnd += 5;
	
	var viewStart= explorerViewEnd - explorerViewTimespan
	
	//draw connection lines when scrolling
	if(explorerViewScrolling) {

		var drawLinesFromThread= null, drawLinesFromTimestamp= null, drawLinesToTimestamps= null;

		if(explorerGetViewIntervalResult.length > 0) {
			drawLinesToTimestamps = lastblc.timestampParents
			drawLinesFromThread = lastblc.slot.thread
			drawLinesFromTimestamp = lastblc.timestamp
		}
		
		if(drawLinesFromThread != null && drawLinesFromTimestamp != null && drawLinesToTimestamps != null) {
			var maxAgeDrawLines= 5.0;
			var ageFactor= 0.0
			if(explorerViewLastBlockTimestamp != null && explorerViewTimestampAtLastBlock != null) {
				var projectedAge= (explorerCurViewTimestamp - explorerViewTimestampAtLastBlock)
				ageFactor= Math.min(1.0, Math.max(0.0, 1.0 - projectedAge / maxAgeDrawLines))
			}
			var startypos= threadys[drawLinesFromThread]
			var startxpos= canvw*(drawLinesFromTimestamp-viewStart)/explorerViewTimespan;
			ctx.beginPath();
			for(var threadi= 0 ; threadi < nthreads ; threadi++) {
				var endypos= threadys[threadi]
				var endxpos= canvw*(parseFloat(drawLinesToTimestamps[threadi])-viewStart)/explorerViewTimespan;
				explorerAutoLine(ctx, startxpos, startypos, endxpos, endypos, blocksymbolsize*2);
			}
			ctx.lineWidth= 2;
			ctx.strokeStyle = 'rgba(200, 200, 255, '+ageFactor+')';
			ctx.stroke()
		}
	}
	
	//draw connection lines for search
	if(explorerViewSelId != null) {
		var drawLinesFromThread= null, drawLinesFromTimestamp= null, drawLinesToTimestamps= null;
	
		//Is the info present in the search results ?
		if(explorerBlockSearchResult != null) {
			if((!explorerBlockSearchResult.content.is_stale || explorerBlockSearchResult.content.is_final) && explorerGetViewIntervalResult != null) {
				if(String(explorerBlockSearchResult['what']) == explorerViewSelId) {
					drawLinesToTimestamps = []
					for (var i=0 ; i < nthreads ; i++) {
						parentTimestamp = null
						for (var j=0 ; j < explorerGetViewIntervalResult.length ; j++) {
								if (explorerBlockSearchResult.content.block.header.content.parents[i] == explorerGetViewIntervalResult[j].id) {
									parentTimestamp = explorerGetViewIntervalResult[j].timestamp
									// if (explorerGetViewIntervalResult[j].shift > 1) console.log(3)
									parentTimestamp = explorerGetViewIntervalResult[j].timestamp
									drawLinesToTimestamps.push([i, parentTimestamp])
							}
						}
					}
					drawLinesFromThread = explorerBlockSearchResult.content.block.header.content.slot.thread
					drawLinesFromTimestamp = (explorerGenesisTimestamp + (explorerBlockSearchResult.content.block.header.content.slot.period + explorerBlockSearchResult.content.block.header.content.slot.thread/nthreads) * explorerT0) / 1000
				}
			}
		}

		if(drawLinesFromThread != null && drawLinesFromTimestamp != null && drawLinesToTimestamps != null) {
			var startypos = threadys[drawLinesFromThread]
			var startxpos = canvw*(drawLinesFromTimestamp-viewStart)/explorerViewTimespan;
			ctx.beginPath();
			for(var parenti= 0 ; parenti < drawLinesToTimestamps.length ; parenti++) {
				threadi = drawLinesToTimestamps[parenti][0]
				var endypos = threadys[threadi]
				var endxpos = canvw*(drawLinesToTimestamps[parenti][1]-viewStart)/explorerViewTimespan;
				// TODO : don't draw if to far
				explorerAutoLine(ctx, startxpos, startypos, endxpos, endypos, blocksymbolsize*2);
			}
			ctx.lineWidth= 2;
			ctx.strokeStyle = '#AEAEFF';
			ctx.stroke()
		}
	}

	//draw blocks
	var selblocki= null
	var drawblock= function(blocki, selected=false) {
		ts= explorerGetViewIntervalResult[blocki].timestamp;
		thrd= explorerGetViewIntervalResult[blocki].slot.thread;
		block_status= explorerGetViewIntervalResult[blocki].status;

		if(explorerGetViewIntervalResult[blocki].is_final)
			ctx.fillStyle = "#50CC20";
		else if(explorerGetViewIntervalResult[blocki].is_stale)
			ctx.fillStyle = "#e82c2c";
		else if(!explorerGetViewIntervalResult[blocki].is_in_blockclique)
			ctx.fillStyle = "#FF8C00";
		else
			ctx.fillStyle = "#0087e5";
		
		var effSymSize= blocksymbolsize
		if(selected)
			effSymSize = blocksymbolsize*2.0
		xpos = canvw*(ts-viewStart)/explorerViewTimespan
		ypos = threadys[thrd]
		resx= xpos-effSymSize/2
		resy= ypos-effSymSize/2
		resw= effSymSize
		resh= effSymSize
		ctx.fillRect(resx,resy,resw,resh);
		ctx.beginPath();
		if(selected) {
			ctx.lineWidth= 1;
			ctx.strokeStyle = '#000000';
			ctx.strokeRect(resx,resy,resw,resh)
		}
		
		explorerGetViewIntervalResult[blocki].drawX= xpos/canv.width
		explorerGetViewIntervalResult[blocki].drawY= ypos/canv.height
		explorerGetViewIntervalResult[blocki].drawW= resw/canv.width
		explorerGetViewIntervalResult[blocki].drawH= resh/canv.height
	}
	for(var blocki= 0 ; blocki < explorerGetViewIntervalResult.length ; blocki++) {
		if(explorerViewSelId != null) {
			if(explorerGetViewIntervalResult[blocki].id == explorerViewSelId) {
				selblocki= blocki;
				continue;	
			}
		}
		drawblock(blocki)
	}
	if(selblocki != null)
		drawblock(selblocki, true);
	
	if(relaunch)
		window.requestAnimationFrame(explorerViewUpdate)
}
