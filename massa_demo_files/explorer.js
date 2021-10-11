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
		nthreads = resJson.thread_count
		explorerGenesisTimestamp = resJson.genesis_timestamp
		explorerT0 = resJson.t0
	}
	function onerror(error, xhr) {
		if(explorerGetViewIntervalXhr != null) { // yeah, otherwise we actually wanted it to die
			explorerGetViewIntervalXhr= null;
			explorerGetViewIntervalTimeout= setTimeout(explorerGetConfig, 3000)
		}
	}

	RESTRequest("GET", 'consensus_config', null, onresponse, onerror);
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
		if(explorerViewEnd == null || explorerViewIntervalBlocks == null)
			return
		explorerViewUpdate(null, false)
		var clickX= (evt.offsetX/canv.width);
		var clickY= (evt.offsetY/canv.height);
		var xytolerance= 0.05
		var xtolerance= (xytolerance * Math.min(canv.width,canv.height))/canv.width
		var ytolerance= (xytolerance * Math.min(canv.width,canv.height))/canv.height
		var mindist= -1
		var mini= null
		for(var i= 0 ; i < explorerViewIntervalBlocks.length ; i++) {
			var blockx= explorerViewIntervalBlocks[i].drawX
			var blocky= explorerViewIntervalBlocks[i].drawY
			var blockw= explorerViewIntervalBlocks[i].drawW
			var blockh= explorerViewIntervalBlocks[i].drawH
			
			if(clickX<blockx-xtolerance-blockw/2||clickX>blockx+xtolerance+blockw/2||clickY<blocky-ytolerance-blockh/2||clickY>blocky+ytolerance+blockh/2)
				continue
			var dist= (blockx-clickX)*(blockx-clickX) + (blocky-clickY)*(blocky-clickY)
			if(mindist < 0 || dist < mindist) {
				mindist= dist;
				mini= i;
			}
		}
		if(mini != null)
			openhash('#explorer?explore=' + encodeURIComponent(explorerViewIntervalBlocks[mini].blockId) + '&nocenter');
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
		explorerSearchTimeout = setTimeout(explorerSearch, 10000, what, false)
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

		explorerSetBlockSearchTable(resJson);
		// var statusdiv= document.getElementById('explorerSearchStatus');
		// if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }

		explorerSearchBlockXhr= null;
		// explorerSearchBlockTimeout= setTimeout(explorerSearchBlock, 10000, what, false)
		
		if(explorerViewSelCenter) {
			if(resJson['Active'])
				explorerViewEnd = (explorerGenesisTimestamp + (resJson.Active.header.content.slot.period + resJson.Active.header.content.slot.thread/nthreads) * explorerT0) / 1000 + explorerViewTimespan/2;
			else if(resJson['Stored'])
				explorerViewEnd = (explorerGenesisTimestamp + (resJson.Stored.header.content.slot.period + resJson.Stored.header.content.slot.thread/nthreads) * explorerT0) / 1000 + explorerViewTimespan/2;
			document.getElementById('explorer_livescroll').checked = false;
			explorerViewScrolling= false;
		}

		explorerViewSelCenter= false
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
	explorerSearchBlockXhr = RESTRequest("GET", 'block/'+encodeURIComponent(what), null, onresponse, onerror);
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
	explorerSearchTransactionXhr = RESTRequest("GET", 'get_operations?operation_ids[0]='+encodeURIComponent(what), null, onresponse, onerror);
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
		if (resJson[resJson.what].final_ledger_data.balance != 0 || resJson[resJson.what].candidate_ledger_data.balance !=0 || resJson[resJson.what].locked_balance != 0 || resJson[resJson.what].final_rolls !=0 || resJson[resJson.what].active_rolls || resJson[resJson.what].candidate_rolls != 0) {
			explorerSearchCreatedBlocks(resJson)

			explorerSearchAddressXhr= null;
			// explorerSearchAddressTimeout= setTimeout(explorerSearchAddress, 10000, what, false)

			explorerViewSelCenter= false
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
	explorerSearchAddressXhr = RESTRequest("GET", 'addresses_info?addrs[0]='+encodeURIComponent(what), null, onresponse, onerror);
}

var explorerSearchCreatedBlocksXhr= null
// var explorerSearchAddressTimeout= null
explorerSearchCreatedBlocks= function(jsondata) {
	// if(explorerSearchAddressTimeout != null) { clearTimeout(explorerSearchAddressTimeout); explorerSearchAddressTimeout=null; }
	if(explorerSearchCreatedBlocksXhr != null) { var tmp=explorerSearchCreatedBlocksXhr; explorerSearchCreatedBlocksXhr=null; tmp.abort(); }
	
	// var div= document.getElementById('explorerSearchResult');
	// var statusdiv= document.getElementById('explorerSearchStatus');
	
	// if(first) {
	// 	if(div) div.innerHTML= '';
	// 	explorersearch= document.getElementById('explorersearch');
	// 	if(explorersearch) { explorersearch.value= what; }
	// 	if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'Loading search results...'; }
	// }

	function onresponse(resJson, xhr) {
		// if (resJson[resJson.what].final_ledger_data.balance != 0 || resJson[resJson.what].candidate_ledger_data.balance !=0 || resJson[resJson.what].locked_balance != 0 || resJson[resJson.what].final_rolls !=0 || resJson[resJson.what].active_rolls || resJson[resJson.what].candidate_rolls != 0) {
		jsondata['created_blocks'] = resJson
		addressOperationsSearch(jsondata)

		explorerSearchCreatedBlocksXhr= null;
		// explorerSearchAddressTimeout= setTimeout(explorerSearchAddress, 10000, what, false)

		// }
		// else
		// 	requestsRemaining -= 1
	}
	function onerror(error, xhr) {
		requestsRemaining -= 1
		if(explorerSearchCreatedBlocksXhr != null) { 
			explorerSearchCreatedBlocksXhr= null;
			// var statusdiv= document.getElementById('explorerSearchStatus');
			// if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading search data. Retrying...'; }
			// explorerSearchAddressTimeout= setTimeout(explorerSearchAddress, 1000, what, false)
		}
	}
	explorerSearchCreatedBlocksXhr = RESTRequest("GET", 'block_ids_by_creator/'+encodeURIComponent(jsondata['what']), null, onresponse, onerror);
}

var addressOperationsSearchXhr= null
// var addressOperationsSearchTimeout= null
addressOperationsSearch = function(jsondata) {
	// if(address == '') { explorerSearchClear(); return; }
	// if(addressOperationsSearchTimeout != null) { clearTimeout(addressOperationsSearchTimeout); addressOperationsSearchTimeout=null; }
	if(addressOperationsSearchXhr != null) { var tmp=addressOperationsSearchXhr; addressOperationsSearchXhr=null; tmp.abort(); }
	// var div = document.getElementById('explorerSearchResult');
	// var statusdiv = document.getElementById('explorerSearchStatus');

	// explorerViewSelId = address
	
	// if(first) {
	// 	if(div) div.innerHTML= '';
	// 	explorersearch= document.getElementById('explorersearch');
	// 	if(explorersearch) { explorersearch.value= address; }
	// 	if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'Loading search results...'; }
	// }
	function onresponse(resJson, xhr) {
		requestsRemaining -= 1
		requestsSuccess += 1
		// explorerSetAddressOperations(tab, resJson)
		jsondata['operations'] = resJson
		explorerSetAddressSearchTable(jsondata)
		
		var statusdiv= document.getElementById('explorerSearchStatus');
		if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }
	}
	function onerror(error, xhr) {
		requestsRemaining -= 1
		if(addressOperationsSearchXhr != null) { 
			addressOperationsSearchXhr= null;
			var statusdiv= document.getElementById('explorerSearchStatus');
			if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading search data. Retrying...'; }
			// addressOperationsSearchTimeout= setTimeout(addressOperationsSearch, 1000, jsondata, false)
		}
	}
	addressOperationsSearchXhr = RESTRequest("GET", 'operations_involving_address/'+encodeURIComponent(jsondata['what']), null, onresponse, onerror);
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
	if(addressOperationsSearchXhr != null) { var tmp=addressOperationsSearchXhr; addressOperationsSearchXhr=null; tmp.abort(); }
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

	addheader('Block ' + String(jsondata['what']));
	if (jsondata['Active']) {
		addrow('Status', 'Active')
		var tdc = addrow('Creator', null)
		tdc.appendChild(createSearchLink(xbqcrypto.deduce_address(xbqcrypto.base58check_decode(jsondata.Active.header.content['creator']))))
		addrow('Thread', jsondata.Active.header.content.slot['thread'])
		addrow('Period', jsondata.Active.header.content.slot['period'])
		addrow('Signature', jsondata.Active.header['signature'])
		
		var operations = jsondata.Active.operations;
		addrow('Op. Count', operations.length)
		for(var i= 0 ; i < operations.length ; i++) {
			parsed_fee = parseInt(new Decimal(operations[i].content.fee).times(1e9))
			parsed_amount = parseInt(new Decimal(operations[i].content.op.Transaction.amount).times(1e9))
			var op_bytes_compact = xbqcrypto.compute_bytes_compact(parsed_fee, operations[i].content.expire_period, operations[i].content.sender_public_key, 0, operations[i].content.op.Transaction.recipient_address, parsed_amount)
			var tx_id = xbqcrypto.base58check_encode(xbqcrypto.hash_sha256(xbqcrypto.Buffer.concat([op_bytes_compact, xbqcrypto.base58check_decode(operations[i].signature)])))
			var tdc= addrow('Transaction', null)
			tdc.appendChild(createSearchLink(String(tx_id)));
		}

		var endorsements = jsondata.Active.header.content.endorsements
		for(var i= 0 ; i < endorsements.length ; i++) {
			var tdc = addrow('Endorsement ' + endorsements[i].content.index, String(endorsements[i].content.sender_public_key))
		}
		
		parentIds = jsondata.Active.header.content['parents'];
		for(var i= 0 ; i < parentIds.length ; i++) {
			var tdc= addrow('Parent (thread ' + i + ')', null)
			tdc.appendChild(createSearchLink(String(parentIds[i])));
		}
	}
	else if (jsondata['Final']) {
		addrow('Status', 'Final')
		var tdc = addrow('Creator', null)
		tdc.appendChild(createSearchLink(xbqcrypto.deduce_address(xbqcrypto.base58check_decode(jsondata.Final.header.content['creator']))))
		addrow('Thread', jsondata.Final.header.content.slot['thread'])
		addrow('Period', jsondata.Final.header.content.slot['period'])
		addrow('Signature', jsondata.Final.header['signature'])

		var operations = jsondata.Final.operations;
		addrow('Op. Count', operations.length)
		for(var i= 0 ; i < operations.length ; i++) {
			parsed_fee = parseInt(new Decimal(operations[i].content.fee).times(1e9))
			parsed_amount = parseInt(new Decimal(operations[i].content.op.Transaction.amount).times(1e9))
			var op_bytes_compact = xbqcrypto.compute_bytes_compact(parsed_fee, operations[i].content.expire_period, operations[i].content.sender_public_key, 0, operations[i].content.op.Transaction.recipient_address, parsed_amount)
			// var tx_id = xbqcrypto.base58check_encode(xbqcrypto.hash_sha256(xbqcrypto.Buffer.concat([op_bytes_compact, xbqcrypto.base58check_decode(operations[i].signature)])))
			var tx_id = xbqcrypto.base58check_encode(xbqcrypto.hash_sha256(xbqcrypto.Buffer.concat([op_bytes_compact, xbqcrypto.Buffer.from(operations[i].signature, "hex")])))
			var tdc= addrow('Transaction', null)
			tdc.appendChild(createSearchLink(String(tx_id)));
		}
		
		parentIds = jsondata.Final.header.content['parents'];
		for(var i= 0 ; i < parentIds.length ; i++) {
			var tdc= addrow('Parent (thread ' + i + ')', null)
			tdc.appendChild(createSearchLink(String(parentIds[i])));
		}
	}
	else if (jsondata['Discarded']) {
		addrow('Status', 'Discarded (' + jsondata.Discarded + ')')
	}
	else {
		var tr = document.createElement('TR');
		tab.appendChild(tr);
		var td_field= document.createElement('TD');
		td_field.classList.add('smalltd');
		tr.appendChild(td_field);
		td_field.appendChild(document.createTextNode('Block not found'));
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
	var operation_type = Object.keys(jsondata[0][1]['op']["content"]["op"])[0]
	var tdc= addrow('Operation type', operation_type)
	if(operation_type=="RollBuy") {
		var roll_count = jsondata[0][1]['op']["content"]["op"].RollBuy.roll_count
		var tdc= addrow('Roll Count', roll_count);
	}
	var transactionInBlocks = jsondata[0][1]['in_blocks'];
	Object.entries(transactionInBlocks).forEach(([key, value]) => {
		var tdc= addrow('In block', null);
		tdc.appendChild(createSearchLink(String(key)));
		if(value[1]) {
			addrow('Finality state', 'Final');
		}
		else
			addrow('Finality state', 'Pending');
	});
	var addr = String(jsondata[0][1]['op']['content']['sender_public_key']);
	addr = xbqcrypto.parse_public_base58check(addr).pubkey
	addr = xbqcrypto.deduce_address(addr)
	var tdc= addrow('From', null);
	tdc.appendChild(createSearchLink(addr));
	if(operation_type=="Transaction") {
		var tdc= addrow('To', null);
		tdc.appendChild(createSearchLink(String(jsondata[0][1]['op']['content']['op']['Transaction']['recipient_address'])));
		var value = new Decimal(jsondata[0][1]['op']['content']['op']['Transaction']['amount'])
		addrow('Value', value);
		var fee = new Decimal(jsondata[0][1]['op']['content']['fee'])
		addrow('Fee', fee);
	}
	addrow('In pool', jsondata[0][1]['in_pool']);
	addrow('Thread', xbqcrypto.get_address_thread(addr));
}


explorerAddressSearchResult= null
explorerSetAddressSearchTable= function(jsondata) {
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
	
	var balance = new Decimal(jsondata[jsondata.what].final_ledger_data.balance)
	addrow('Final balance', balance);
	var candidate_balance = new Decimal(jsondata[jsondata.what].candidate_ledger_data.balance)
	addrow('Candidate balance', candidate_balance);
	var locked_balance = new Decimal(jsondata[jsondata.what].locked_balance)
	addrow('Locked balance', locked_balance);
	var thread = xbqcrypto.get_address_thread(jsondata['what'])
	addrow('Thread', thread);

	var final_rolls = jsondata[jsondata.what].final_rolls
	addrow('Final rolls', final_rolls);
	var active_rolls = jsondata[jsondata.what].active_rolls
	addrow('Active rolls', active_rolls);
	var candidate_rolls = jsondata[jsondata.what].candidate_rolls
	addrow('Candidate rolls', candidate_rolls);

	for (const [key, value] of Object.entries(jsondata['operations'])) {
		var tdc = addrow('Transaction', null);
		tdc.appendChild(createSearchLink(String(key)));
	}

	for (const [key, value] of Object.entries(jsondata['created_blocks'])) {
		var tdc = addrow('Block (' + String(value) + ')', null);
		tdc.appendChild(createSearchLink(String(key)));
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

var explorerUpdateInfoXhr= null
var explorerUpdateInfoTimeout= null
explorerUpdateInfo= function(first=true) {
	if(explorerUpdateInfoTimeout != null) { clearTimeout(explorerUpdateInfoTimeout); explorerUpdateInfoTimeout=null; }
	if(explorerUpdateInfoXhr != null) { var tmp=explorerUpdateInfoXhr; explorerUpdateInfoXhr=null; tmp.abort(); }
	var statusdiv= document.getElementById('explorerInfoStatus');
	if(first && statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'Loading infos...'; }

	function onresponse(resJson, xhr) {
		explorerStakingUpdateInfos(resJson)
		// explorerSetInfo(resJson);
		// var statusdiv= document.getElementById('explorerInfoStatus');
		// if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }
		explorerUpdateInfoXhr= null;
		explorerUpdateInfoTimeout= setTimeout(explorerUpdateInfo, 10000, false)
	}
	function onerror(error, xhr) {
		if(explorerUpdateInfoXhr != null) { // yeah, otherwise we actually wanted it to die
			explorerUpdateInfoXhr= null;
			var statusdiv= document.getElementById('explorerInfoStatus');
			if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading infos. Retrying...'; }
			explorerUpdateInfoTimeout= setTimeout(explorerUpdateInfo, 3000, false)
		}
	}
	explorerUpdateInfoXhr= RESTRequest("GET", 'get_stats', null, onresponse, onerror);
}

var explorerStakingUpdateInfosXhr = null
explorerStakingUpdateInfos = function(jsondata) {
	function onresponse(resJson, xhr) {
		jsondata['stakers'] = resJson
        explorerNodesUpdateInfos(jsondata);
	}
	function onerror(error, xhr) {
		if(explorerStakingUpdateInfosXhr != null) { // yeah, otherwise we actually wanted it to die
			explorerStakingUpdateInfosXhr = null;
			var statusdiv= document.getElementById('explorerInfoStatus');
			if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading infos. Retrying...'; }
		}
	}
	stakingUpdateInfosXhr= RESTRequest("GET", 'active_stakers', null, onresponse, onerror);
}

var explorerNodesUpdateInfosXhr = null
explorerNodesUpdateInfos = function(jsondata) {
	function onresponse(resJson, xhr) {
		jsondata['nodes'] = resJson
        explorerSetInfo(jsondata);
		var statusdiv= document.getElementById('explorerInfoStatus');
		if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }
	}
	function onerror(error, xhr) {
		if(explorerNodesUpdateInfosXhr != null) { // yeah, otherwise we actually wanted it to die
			explorerNodesUpdateInfosXhr = null;
			var statusdiv= document.getElementById('explorerInfoStatus');
			if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading infos. Retrying...'; }
		}
	}
	stakingUpdateInfosXhr= RESTRequest("GET", 'peers', null, onresponse, onerror);
}

explorerSetInfo= function(jsondata) {
	var div= document.getElementById('explorerInfo');
	if(!div) return;

	// Create items array
    var items = Object.keys(jsondata['stakers']).map(function(key) {
	return [key, jsondata['stakers'][key]];
	});
	// Sort the array based on the second element
	items.sort(function(first, second) {
	return second[1] - first[1];
	});
	var totstakers = 0
	var totrolls = 0
	items.forEach(function (item, index) {
		totstakers += 1
		totrolls += item[1]
	});

	var date = new Date(explorerGenesisTimestamp);
	var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  	var year = date.getFullYear();
  	var month = months[date.getMonth()];
  	var day = date.getDate();
	var hours = date.getHours();
	var minutes = "0" + date.getMinutes();
	var seconds = "0" + date.getSeconds();
	var formattedTime = day + ' ' + month + ' ' + year + ', ' + hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);

	// var n_nodes = 1
	// for (const [key, value] of Object.entries(jsondata['nodes']['peers'])) {
	// 	if(value['peer_info']['active_out_connections'] > 0 || value['peer_info']['active_in_connections'] > 0)
	// 		n_nodes += 1
	// }

	data = jsondata;
	div.innerHTML = '<span>\
	Last Reboot: <b>' + formattedTime + '</b><br>\
	Block Throughput: <b>' + Math.round((data.final_block_count / data.timespan * 1000 + Number.EPSILON) * 1000) / 1000 + ' b/s' + '</b><br>\
	Transaction Throughput: <b>' + Math.round((data.final_operation_count / data.timespan * 1000 + Number.EPSILON) * 1000) / 1000 + ' tx/s' + '</b><br>\
	Number of Cliques: <b>' + data.clique_count + '</b><br>\
	Block Stale Rate: <b>' + Math.round((data.stale_block_count / data.timespan * 1000 + Number.EPSILON) * 1000) / 1000 + ' b/s' + '</b><br>\
	Number of Stakers: <b>' + totstakers + '</b><br>\
	Number of Rolls: <b>' + totrolls + '</b><br>\
	</span>';

	// Number of final blocks: <b>' + data.final_block_count + '</b><br>\
	// Time of Simulation: <b>' + data.timespan + '</b><br>\
	// Block Throughput: <b>' + data.finalBps + ' b/s' + '</b><br>\
	// Average Transaction Time: <b>' + Math.round(data.avgTimeTx * 10) / 10 + ' sec' + '</b><br>\
	// Total Stake: <b>' + data.totalStakes + '</b><br>\
	// Number of Stakers: <b>' + data.nStakers + '</b><br>\
	
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
		explorerGetViewIntervalResult = resJson
		explorerUpdateInfoXhr= null;
		if(explorerGetViewIntervalTimeout != null) { clearTimeout(explorerGetViewIntervalTimeout); explorerGetViewIntervalTimeout=null; }
		var timeoutVal= 500; //TODO update less often if we are looking in the distant past
		if(explorerViewDragging)
			timeoutVal= 250; 
		explorerGetViewIntervalTimeout= setTimeout(explorerGetViewInterval, timeoutVal)
		
		// if(resJson != null && resJson.hasOwnProperty('timeStart') && resJson.hasOwnProperty('timeEnd') && resJson.hasOwnProperty('blockIds') && resJson.hasOwnProperty('threads') && resJson.hasOwnProperty('timestamps')) {
		// if( (resJson.blockIds.length == resJson.threads.length) && (resJson.threads.length == resJson.timestamps.length) && (resJson.status.length == resJson.status.length) ) {
		if (resJson.length > 0) {
			explorerViewIntervalBlocks= []

			for(var i = 0 ; i < resJson.length ; i++) {
				explorerViewIntervalBlocks.push( {
					thread: parseInt(resJson[i][1].thread),
					period: parseInt(resJson[i][1].period),
					blockId: String(resJson[i][0]),
					timestamp: (explorerGenesisTimestamp + (resJson[i][1].period + resJson[i][1].thread/nthreads) * explorerT0) / 1000,
					status: resJson[i][2],
					parents: resJson[i][3]} );
			}

			if(explorerViewScrolling && explorerViewIntervalBlocks.length > 0) {

				lastblc = explorerViewIntervalBlocks[0]
				explorerMaxPeriod = explorerViewIntervalBlocks[0].period
				explorerMaxThread = explorerViewIntervalBlocks[0].thread
				for(var i = 0 ; i < explorerViewIntervalBlocks.length ; i++) {
					if (parseInt(explorerViewIntervalBlocks[i].period) > explorerMaxPeriod) {
						explorerMaxPeriod = explorerViewIntervalBlocks[i].period
						explorerMaxThread = explorerViewIntervalBlocks[i].thread
						lastblc = explorerViewIntervalBlocks[i]
					} else if (parseInt(explorerViewIntervalBlocks[i].period) == explorerMaxPeriod) {
						if (parseInt(explorerViewIntervalBlocks[i].thread) > explorerMaxThread) {
							explorerMaxThread = explorerViewIntervalBlocks[i].thread
							lastblc = explorerViewIntervalBlocks[i]
						}
					} else {}
				}

				// lastblc = explorerViewIntervalBlocks[explorerViewIntervalBlocks.length-1]
	            lastblc.timestampParents = []

	            for (var i=0 ; i < nthreads ; i++) {
            		// TODO
            		parentTimestamp = null
            		for (var j=0 ; j < resJson.length ; j++) {
  						if (lastblc.parents[i] == resJson[j][0]) {
  							parentTimestamp = (explorerGenesisTimestamp + (resJson[j][1].period + resJson[j][1].thread/nthreads) * explorerT0) / 1000
						}
					}
            		lastblc.timestampParents.push(parentTimestamp)
	            }
				
				if(explorerViewLastBlockId != lastblc.blockId) {
					explorerViewLastBlockTimestamp= lastblc.timestamp
					explorerViewTimestampAtLastBlock= explorerCurViewTimestamp
					explorerViewLastBlockId= lastblc.blockId;
				}
			}

			explorerViewLastEnd= resJson.timeEnd;
			explorerViewTimestampAtLastEnd= explorerCurViewTimestamp;
			if(explorerViewScrolling) {
				if(explorerViewKeypointEnd == null || explorerViewTimestampAtKeypointEnd == null) {
					// TODO
					// explorerViewKeypointEnd= resJson.timeEnd;
					explorerViewKeypointEnd= Date.now() / 1000
					explorerViewTimestampAtKeypointEnd= explorerCurViewTimestamp;
				}
			}
			if(explorerViewEnd == null)
				// TODO
				// explorerViewEnd= resJson.timeEnd;
				explorerViewEnd= Date.now() / 1000
		}
		// }
		// }
		// else {
		//     if(resJson != null)
		//         console.log('Explorer format error.');
	    // }
	    finished_loading('explorer_graph');
	}
	function onerror(error, xhr) {
		if(explorerGetViewIntervalXhr != null) { // yeah, otherwise we actually wanted it to die
			explorerGetViewIntervalXhr= null;
			explorerGetViewIntervalTimeout= setTimeout(explorerGetViewInterval, 3000)
		}
	}

	if(explorerViewScrolling) {
		// viewStart= - explorerViewTimespan - explorerViewTimePad
		// viewEnd= -1
		// TODO
		viewEnd = Date.now()
		viewStart = viewEnd - (explorerViewTimespan + explorerViewTimePad) * 1000
	}
	else if(explorerViewEnd != null) {
		viewStart = Math.floor((explorerViewEnd - explorerViewTimespan - explorerViewTimePad) * 1000)
		viewEnd = Math.ceil((explorerViewEnd + explorerViewTimePad) * 1000)
		if(viewStart < 0) viewStart= 0
		if(viewEnd < 0) viewEnd= 0
	}
	else
		viewStart = Math.floor((-explorerViewTimespan - explorerViewTimePad) * 1000), viewEnd= Date.now()

	// Rounding for cache
	viewStart = Math.floor(viewStart/500) * 500
	viewEnd = Math.floor(viewEnd/500) * 500
	explorerGetViewIntervalXhr = RESTRequest("GET", 'graph_interval?start='+encodeURIComponent(viewStart)+'&end='+encodeURIComponent(viewEnd), null, onresponse, onerror);
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

explorerViewUpdate= function(timestamp=null, relaunch=true) {

	if (timestamp != null)
		explorerCurViewTimestamp= timestamp/1000.0;

	var canv= document.getElementById('explorer_livecanvas');
	if(!canv) {
		window.requestAnimationFrame(explorerViewUpdate)
		return;
	}
	var canvw= canv.scrollWidth;
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
	
	var blocksymbolsize= Math.max(1,Math.min(lineyinterval-2, 30))
	
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

		if(explorerViewIntervalBlocks.length > 0) {
			// if(explorerViewIntervalBlocks[explorerViewIntervalBlocks.length-1].hasOwnProperty('timestampParents')) {
			// 	var blc= explorerViewIntervalBlocks[explorerViewIntervalBlocks.length-1];
			// TODO
			drawLinesToTimestamps = lastblc.timestampParents
			drawLinesFromThread = lastblc.thread
			drawLinesFromTimestamp = lastblc.timestamp
			// }
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
			// TODO
			if((explorerBlockSearchResult['Active'] || explorerBlockSearchResult['Final']) && explorerGetViewIntervalResult != null) {
				if(explorerBlockSearchResult['Active'])
					var status = 'Active'
				else
					var status = 'Final'
				if(String(explorerBlockSearchResult['what']) == explorerViewSelId) {
					drawLinesToTimestamps = []
					for (var i=0 ; i < nthreads ; i++) {
						parentTimestamp = null
						for (var j=0 ; j < explorerGetViewIntervalResult.length ; j++) {
								if (explorerBlockSearchResult[status].header.content.parents[i] == explorerGetViewIntervalResult[j][0]) {
									parentTimestamp = (explorerGenesisTimestamp + (explorerGetViewIntervalResult[j][1].period + explorerGetViewIntervalResult[j][1].thread/nthreads) * explorerT0) / 1000
									drawLinesToTimestamps.push([i, parentTimestamp])
							}
						}
					}
					drawLinesFromThread = parseInt(explorerBlockSearchResult[status].header.content.slot['thread'])
					drawLinesFromTimestamp = (explorerGenesisTimestamp + (explorerBlockSearchResult[status].header.content.slot['period'] + explorerBlockSearchResult[status].header.content.slot['thread']/nthreads) * explorerT0) / 1000
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
	var drawblock= function(blocki, selected= false) {
		ts= explorerViewIntervalBlocks[blocki].timestamp;
		thrd= explorerViewIntervalBlocks[blocki].thread;
		status= explorerViewIntervalBlocks[blocki].status;

		if(status == 'Final')
			ctx.fillStyle = "#50CC20";
		else if(status == 'Stale')
			ctx.fillStyle = "#e82c2c";
		else if(status == 'Active')
			ctx.fillStyle = "#0087e5";
		else
			ctx.fillStyle = "#FF8C00";
		
		var effSymSize= blocksymbolsize
		if(selected)
			effSymSize = blocksymbolsize*2.0
		xpos= canvw*(ts-viewStart)/explorerViewTimespan;
		ypos= threadys[thrd]
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
		
		explorerViewIntervalBlocks[blocki].drawX= xpos/canv.width
		explorerViewIntervalBlocks[blocki].drawY= ypos/canv.height
		explorerViewIntervalBlocks[blocki].drawW= resw/canv.width
		explorerViewIntervalBlocks[blocki].drawH= resh/canv.height
	}
	for(var blocki= 0 ; blocki < explorerViewIntervalBlocks.length ; blocki++) {
		if(explorerViewSelId != null) {
			if(explorerViewIntervalBlocks[blocki].blockId == explorerViewSelId) {
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
