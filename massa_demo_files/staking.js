staking_stakerlist= [];
staking_creatingstaker= false;
staking_maxpower=null;
stakingProcessCommands= function(pageid, cmds) {
    if(pageid == 'staking') {
        stakingUpdateInfos();
    }
    else {
	    if(stakingUpdateInfosTimeout != null) { clearTimeout(stakingUpdateInfosTimeout); stakingUpdateInfosTimeout=null; }
	    if(stakingUpdateInfosXhr != null) { var tmp=stakingUpdateInfosXhr; stakingUpdateInfosXhr=null; tmp.abort(); }
    }
}

// stakingInit= function() {
//     staking_stakerlistarea= document.getElementById('staking_stakerlist');
//     staking_stakertable= document.getElementById('staking_stakertable');
//     staking_create_staker_form= document.getElementById('create_staker_form');
//     staking_createstaker_progress= document.getElementById('staking_createstaker_progress');
//     staking_infostatus= document.getElementById('stakingInfoStatus');
//     staking_info= document.getElementById('stakingInfo');
//     staker_duration= document.getElementById('staker_duration');
//     staker_duration.addEventListener("input", function() {
//         staker_duration.removeAttribute("aria-invalid");
//     });
//     staker_power= document.getElementById('staker_power');
//     staker_power.addEventListener("input", function() {
//         staker_power.removeAttribute("aria-invalid");
//     });
//     staker_address= document.getElementById('staker_address');
//     staker_address.addEventListener("input", function() {
//         staker_address.removeAttribute("aria-invalid");
//     });
//     staker_bandwidth= document.getElementById('staker_bandwidth');
//     staker_bandwidth.addEventListener("input", function() {
//         staker_bandwidth.removeAttribute("aria-invalid");
//     });
//     staking_create_staker_form.addEventListener("submit", function(e) {
//         e.preventDefault();
//         staking_new_staker_submit();
//     }, false);
//     stakingDisplayList();
//     stakingUpdateInfos();
//     stakingDisplayCreatestaker();
//     finished_loading('staking_init');
// }

staking_new_staker_submit= function() {
    // validate staker duration
    var tmp_duration = staker_duration.value;
    if(tmp_duration == '' && staking_maxduration != null) {
        tmp_duration = String(staking_maxduration);
    }
    var res_duration= (tmp_duration == '' ? NaN : Number(tmp_duration));
    if(isNaN(res_duration) || res_duration < 60 || (staking_maxduration != null && res_duration > staking_maxduration)) {
        staker_duration.setAttribute("aria-invalid", "true");
        res_duration= null;
    } else {
        staker_duration.removeAttribute("aria-invalid");
        staker_duration.value= res_duration;
    }
    
    // validate staker power
    var tmp_power = staker_power.value;
    if(tmp_power == '' && staking_maxpower != null) {
        tmp_power = String(Math.floor(staking_maxpower*100)/100);
    }
    var res_power= (tmp_power == '' ? NaN : Number(tmp_power));
    if(isNaN(res_power) || res_power < 0 || (staking_maxpower != null && res_power > staking_maxpower)) {
        staker_power.setAttribute("aria-invalid", "true");
        res_power= null;
    } else {
        staker_power.removeAttribute("aria-invalid");
        staker_power.value= res_power;
    }
    
    // validate target address
    var res_address= null;
    try {
        xbqcrypto.parse_address(staker_address.value);
        res_address= staker_address.value;
        staker_address.removeAttribute("aria-invalid");
    } catch(e) {
        staker_address.setAttribute("aria-invalid", "true");
        alert("Please choose a valid target address. If you don't have any, create one from the Wallet tab.")
    }
    
    // validate staker bandwidth
    var res_bandwidth= (staker_bandwidth.value == '' ? 64 : Number(staker_bandwidth.value));
    if(isNaN(res_bandwidth) || res_bandwidth < 32 || res_bandwidth > 128) {
        staker_bandwidth.setAttribute("aria-invalid", "true");
        res_bandwidth= null;
    } else {
        staker_bandwidth.removeAttribute("aria-invalid");
        staker_bandwidth.value= res_bandwidth;
    }
    
    if(res_duration == null || res_power == null || res_address == null || res_bandwidth == null)
        return;
    
    requestdata=
         'timestamp=' + encodeURIComponent(xbqcrypto.get_timestamp())
       + '&duration=' + encodeURIComponent(res_duration)
       + '&power=' + encodeURIComponent(res_power)
       + '&address=' + encodeURIComponent(res_address)
       + '&bandwidth=' + encodeURIComponent(res_bandwidth);
    
    stakingCreatestaker(requestdata);
}

stakingAddStakerToList= function(stakerid) {
    for(var i= 0 ; i < staking_stakerlist.length ; i++)
        if(staking_stakerlist[i].stakerid == stakerid)
            return;
    staking_stakerlist.push({
        stakerid: stakerid
    });
    stakingDisplayList();
}

stakingRemoveStakerFromList= function(stakerid) {
    for(var i= 0 ; i < staking_stakerlist.length ; i++) {
        if(staking_stakerlist[i].stakerid == stakerid) {
            staking_stakerlist.splice(i, 1);
            stakingDisplayList();
            return;
        }
    }
}

stakingDisplayList= function() {
    var resHTML=  '';
    for(var mi = 0 ; mi < staking_stakerlist.length ; mi++) {
        var staker= staking_stakerlist[mi];
        var stakerid= staker.stakerid;
        resHTML += '<tr><td><a href="#explorer?explore='+encodeURIComponent(stakerid)+'">'+stakerid+'</a></td><td><a class="delete" id="delete_'+stakerid+'">✘︎</a></td></tr>';
    }
    staking_stakertable.innerHTML= resHTML;
    for(var mi = 0 ; mi < staking_stakerlist.length ; mi++) {
        var staker= staking_stakerlist[mi];
        var stakerid= staker.stakerid;
        document.getElementById('delete_'+stakerid).addEventListener("click", function(key){return function(){
            stakingRemoveStakerFromList(key);
        }}(stakerid));
    }
    staking_stakerlistarea.style.display= ( (resHTML == '') ? 'none' : '')
}

stakingApplyInfos= function(resJson) {
    staking_infostatus.innerHTML= "&nbsp;";
    staking_infostatus.style.color= '';
    staking_maxduration= Number(resJson['maxDuration']);
    staking_maxpower= Number(resJson['maxPower']);
    if(isNaN(staking_maxduration) || isNaN(staking_maxpower))
        throw "Invalid max info received.";
    document.getElementById('staking_maxduration').innerHTML= staking_maxduration;
    document.getElementById('staking_maxpower').innerHTML= Math.floor(staking_maxpower*100)/100;
    document.getElementById('staker_duration').placeholder = String(staking_maxduration);
    document.getElementById('staker_power').placeholder = String(Math.floor(staking_maxpower*100)/100);
    if(resJson['result'] == 'FULL') {
        staking_infostatus.innerHTML= 'Max number of simulated stakers reached.';
        staking_infostatus.style.color= 'red';
    }
}

stakingDisplayCreatestaker= function() {
    if(staking_creatingstaker) {
        staking_create_staker_form.style.display= 'none';
        staking_createstaker_progress.innerHTML= 'Creating staker...';
    } else {
        staking_create_staker_form.style.display= '';
        staking_createstaker_progress.innerHTML= '';
    }
}

// var stakingCreatestakerXhr= null;
// var stakingCreatestakerTimeout= null;
// stakingCreatestaker= function(data) {
// 	if(stakingCreatestakerTimeout != null) { clearTimeout(stakingCreatestakerTimeout); stakingCreatestakerTimeout=null; }
// 	if(stakingCreatestakerXhr != null) { var tmp=stakingCreatestakerXhr; stakingCreatestakerXhr=null; tmp.abort(); }
	
// 	function onresponse(resJson, xhr) {
// 		stakingCreatestakerXhr= null;
// 		if(resJson.result == "OK") {
// 		    alert("Staker successfully created:\n" + resJson.stakerId);
// 		    stakingAddStakerToList(resJson.stakerId);
// 		    staking_create_staker_form.reset();
// 		} else {
// 		    alert('An error occured while creating staker: ' + resJson.errorMessage + '. staker not created.');
// 		}
// 	    staking_creatingstaker= false;
// 	    stakingDisplayCreatestaker();
// 	}
// 	function onerror(error, xhr) {
// 		if(stakingCreatestakerXhr != null) { // yeah, otherwise we actually wanted it to die
// 			stakingCreatestakerXhr= null;
// 			if(confirm('An network error occured while creating the staker: '+ error +'. Retry ?')) {
// 			    stakingCreatestaker(data);
// 			} else {
// 			    staking_creatingstaker= false;
// 			    stakingDisplayCreatestaker();
// 			}
// 		}
// 	}
// 	staking_creatingstaker= true;
// 	stakingDisplayCreatestaker();
// 	walletSendTransactionXhr= RESTRequest("PUT", 'createStaker', data, onresponse, onerror);
// }

stakingInfoResult = null
stakingInfoSetTable = function(jsondata) {
	stakingInfoResult = jsondata
	var div = document.getElementById('stakingInfoResult');
	if (!div) return;
	div.innerHTML= '';

	var tab = document.createElement('TABLE');
	div.appendChild(tab);
    var htr = document.createElement('TR');
	tab.appendChild(htr);
	var hth1 = document.createElement('TH');
	htr.appendChild(hth1);
    var hth2 = document.createElement('TH');
	htr.appendChild(hth2);
    var hth3 = document.createElement('TH');
	htr.appendChild(hth3);
	// hth.colSpan = 2;
	hth1.classList.add('ellipsis');
    hth2.classList.add('ellipsis');
    hth3.classList.add('ellipsis');
    hth1.appendChild(document.createTextNode('Address'));
    hth2.appendChild(document.createTextNode('Rolls'));
    hth3.appendChild(document.createTextNode('%'));

	// var addheader= function(h) {
	// 	hth.appendChild(document.createTextNode(String(h)));
	// }

	var addrow= function(field, content1, content2) {
		var tr = document.createElement('TR');
		tab.appendChild(tr);
		var td_field = document.createElement('TD');
		td_field.classList.add('keylink');
        td_field.classList.add('ellipsis');
		tr.appendChild(td_field);
		td_field.appendChild(field);
		var td_content= document.createElement('TD');
		td_content.classList.add('ellipsis');
		tr.appendChild(td_content);
        td_content.appendChild(document.createTextNode(String(content1)));
        var td_content= document.createElement('TD');
		td_content.classList.add('ellipsis');
		tr.appendChild(td_content);
        td_content.appendChild(document.createTextNode(String(content2)));
		return td_content
	}

	var createSearchLink = function(target) {
		a = document.createElement('A');
		a.classList.add('keylink');
		a.href= "#explorer?explore=" + encodeURIComponent(target);
		a.appendChild(document.createTextNode(target))
		return a;
	}

    // Create items array
    var items = Object.keys(jsondata).map(function(key) {
    return [key, jsondata[key]];
    });
    
    // Sort the array based on the second element
    items.sort(function(first, second) {
    return second[1] - first[1];
    });

    var totstakers = 0
    var totrolls = 0
    items.forEach(function (item, index) {
        totstakers = index
        totrolls += item[1]
    });
    totstakers += 1

    items.forEach(function (item, index) {
        // if (index<500) {
        addrow(createSearchLink(item[0]), item[1], Math.round(item[1] / totrolls * 100 * 100) / 100)
        // }
    });

    document.getElementById('staking_totstakers').innerHTML= 'Number of stakers:&nbsp;<b>' + totstakers;
    document.getElementById('staking_totrolls').innerHTML= 'Number of rolls:&nbsp;<b>' + totrolls + '</b>';
}

var stakingUpdateInfosXhr= null
var stakingUpdateInfosTimeout= null
stakingUpdateInfos = function(first=false) {
	if(stakingUpdateInfosTimeout != null) { clearTimeout(stakingUpdateInfosTimeout); stakingUpdateInfosTimeout=null; }
	if(stakingUpdateInfosXhr != null) { var tmp=stakingUpdateInfosXhr; stakingUpdateInfosXhr=null; tmp.abort(); }
	var statusdiv= document.getElementById('stakerInfoStatus');
	if(first && statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= 'Loading infos...'; }

	function onresponse(resJson, xhr) {
        stakingInfoSetTable(resJson);
		var statusdiv = document.getElementById('stakerSearchStatus');
		if(statusdiv) { statusdiv.style.color=''; statusdiv.innerHTML= ''; }
		stakingUpdateInfosXhr = null;
		stakingUpdateInfosTimeout = setTimeout(stakingUpdateInfos, 100000, false)
	}
	function onerror(error, xhr) {
		if(stakingUpdateInfosXhr != null) { // yeah, otherwise we actually wanted it to die
			stakingUpdateInfosXhr= null;
			var statusdiv= document.getElementById('stakerInfoStatus');
			if(statusdiv) { statusdiv.style.color='red'; statusdiv.innerHTML= 'Error loading infos. Retrying...'; }
			stakingUpdateInfosTimeout= setTimeout(stakingUpdateInfos, 10000, false)
		}
	}
	stakingUpdateInfosXhr= RESTRequest("GET", 'active_stakers', null, onresponse, onerror);
}
stakingUpdateInfos(first=true)
