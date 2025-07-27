$(()=>{

	const templates = (()=>{
		return {
			hit: $("#searchresult").detach().html(),
			mail: $("#message").detach().html(),
			message: $("#messagelist").detach().html(),
			search: $("#searchlist").detach().html(),
			term: $("#searchoption").detach().html(),
			wait: $("#plzwait").detach().html()
		}
	})()

	const socket = new WebSocket("ws://localhost:8675/saki");

	let running = false, shbtn, searchterm, subterm, comboqueue, fadercache = {};

	function factory(m) {
		return function handler(e) {
			m.action = "headers";
			socket.send(JSON.stringify(m));
		}
	}

	function searchtemplate(label, mode){
		return $(eval("`"+templates.search+"`"));
	}

	function termtemplate(timestamp, term){
		return $(eval("`"+templates.term+"`"));
	}

	function dateformat(t, long=false, year=true){
		const N=new Date().setTime(t);
		const O={month:'2-digit',day:'2-digit'}
		if (year) O.year = 'numeric';
		if (long) O.hour = O.minute = '2-digit';
		F=new Intl.DateTimeFormat('en-US', O),
		P=F.formatToParts(N),
		V=P.map(p=>p.value);
		return (V.join(''));
	}

	let $wait;
	function renderWait() {
		$wait = $(templates.wait);
		$("body").prepend($wait);

		$wait.modal = new bootstrap.Modal('#modalwait', {
			backdrop: 'static',
			keyboard: false
		})
		$wait.modal.show();
	}

	let $advanced = $("#advanced");
	$advanced.modal = new bootstrap.Modal('#advanced');

	function renderBegin(message){
		updateValid(message);
		
		let list = { action: "list" };
		socket.send(JSON.stringify(list));

		if (message.running) {
			running = true;

			disabler();

			$(".progress").removeClass("d-none");
			
			if (message.running === "search") {
				$("#contains-hits").removeClass("d-none").addClass("d-flex");
			} else {
				$("#contains-hits").removeClass("d-flex").addClass("d-none");
			}
			searchterm = message.term;

			for (let hit of message.hits) {
				renderHits(hit);
			}
		}
	}

	function renderHistory(message){
		$("#hitlist").html("");
		for (let hit of message.hits) {
			renderHits(hit);
		}
	}
			
	function subsearch(mode, { user, pass, domain }) {
		return function (ev) {
			ev.preventDefault();

			if (mode === "search") {
				subterm = $("#subsearch").val();
			} else {
				$("#subsearch").val(subterm);
			}
			let message = {
				action: "subsearch",
				user,
				pass,
				domain,
				term: subterm
			}
			socket.send(JSON.stringify(message))

			return false;
		}
	}

	function renderHits(message){
		let el = $(templates.hit);
		let newest = message.results[0];
		el.find(".to").text(message.user);
		el.find(".date").text(dateformat(newest.date));
		el.find(".hitcounter").text(message.total);
		$("#hitlist").append(el);

		el.on("click", function(event){
			$("#hitlist").find(".list-group-item").removeClass("active");
			el.addClass("active"); 
			
			$("#contains-mail").html(templates.message);

			$("#subsearch").val(searchterm);
			subterm = searchterm;

			$("#subsearch-click").on("click", subsearch("search", message));
			$("#subsearch-repeat").on("click", subsearch("repeat", message));
			$("#submail").on("submit", subsearch("search", message));

			$("#contains-mail").removeClass("d-none");
			
			let mb = $("#mailbox").height();
			let bs = $("#mail-barsub").height();
			$("#mail-scroll").css({
				height: `${mb-(bs+sizehelp)}px`
			})

			renderEmails(message);
		})
	}

	let iframe = document.getElementById("mailbody");

	$(iframe).on("load", event=>{
		console.log("Iframe Loaded");
		let style = iframe.contentDocument.createElement("style");
		style.textContent = `body {
			margin: 0;
		}`;
		iframe.contentDocument.head.appendChild(style)
	})

	function renderEmails(message){
		$("#mail").html("");
		
		for (let m of message.results) {
			let em = $(templates.mail);
			if (!m.read) {
				em.find(".row").addClass("unread");
			} else {
				em.find(".row").addClass("read");
			}
			em.find(".from").text(`${m.from.name ? m.from.name + ` <${m.from.address}>` : m.from.address}`);
			em.find(".date").text(dateformat(m.date, true));
			em.find(".subject").text(m.subject);
			$("#mail").append(em);

			em.on("click", function(evm){
				$("#mail").find("tr").removeClass("table-active");
				em.addClass("table-active");

				let url = "/body?" + new URLSearchParams({
					user: message.user,
					pass: message.pass,
					id: m.id
				});
				
				$("#contains-body").removeClass("d-none");
				iframe.src = url;
			})
		}
	}

	function renderProgress(percent){
		const remain = 100-percent;
		const pba = $("#pba");
		const pbb = $("#pbb");
		pba.css({ width: `${percent}%` });
		pbb.css({ width: `${remain}%` });
		if (percent > 25) {
			pba.text(`${percent}%`);
			pbb.text("");
		} else {
			pbb.text(`${percent}%`);
			pba.text("");
		}
	}

	function updateCountries(message){
		let $cl = $("#countrylist");
		$cl.html("");
		for (let c of message.countries) {
			$cl.append(`<option value="${c.value}">${c.name}</option>`)
		}
	} 

	let historic = 0;

	function renderList(message) {
		let $ddlist = $("#history");
		let $nuke = $("#nukesearches");
		
		historic = message.data.length;

		if (message.data.length > 0) {
			$("#nohistory").hide();
			$ddlist.show();
			$nuke.show()
			$nuke.on("click", event=>{
				if (confirm(`Are you sure you want to delete all search results!?`)) {
					let message = {
						action: "delete",
						type: "all"
					}

					$("#history").html("");
					$ddlist.hide();
					$nuke.hide();
					$("#nohistory").show()
					historic = 0;

					socket.send(JSON.stringify(message));
				}
			})
			for (let data of message.data) {
				let $option = renderOption(data.term, data.timestamp);
				$ddlist.append($option);
			}
		} else {
			$ddlist.hide();
			$nuke.hide();
			$("#nohistory").show()
		}
	}

	function renderOption(term, timestamp) {
		let tsformat = dateformat(timestamp,false,false);
		let $option = termtemplate(tsformat, term)

		$option.find(".previous").on("click", event=>{
			if (!running && searchterm !== term) {

				searchterm = term;
				$("#term").val(searchterm);
				$advanced.modal.hide();

				let message = {
					action: "history",
					term: term
				}
				socket.send(JSON.stringify(message));
			}
		})

		$option.find(".icon.x").on("click", event=>{
			if (confirm(`Are you sure you want to delete search results for "${term}" from ${tsformat}`)) {
				let message = {
					action: "delete",
					type: "search",
					term: term
				}
				historic--;
				$option.detach();

				if (historic === 0) {
					$ddlist.hide();
					$nuke.hide();
					$("#nohistory").show()
				}

				socket.send(JSON.stringify(message));
			}
		})
		return $option;
	}

	function addHistory(term) {
		let $ddlist = $("#history");
		let list = $ddlist.find("li");
		for (let el of list) {
			let compare = $(el).find(".search-term").text();
			if (term.toLowerCase() === compare.toLowerCase()) {
				$(el).detach();
				break;
			}
		}

		$ddlist.prepend(renderOption(term, new Date()));
		historic++;
	}

	function updateValid(message){
		$("#valid").text(message.valid);
	}

	function updateHits(message){
		if (message.running === "search") $("#hits").text(message.hits);
	}

	function fader(el, step, from, until, ms) {
		return new Promise(resolve=>{

			let opacity = Math.round(from * 100);
			let target = Math.round(until * 100);
			let tick = Math.round(step * 100);

			let identifier = el[0].offsetParent?el[0].offsetParent+' ':'';
			identifier += el[0].localName;
			identifier += el[0].id ? "#"+el[0].id : '';
			identifier += el[0].classList.length > 0 ? "."+el[0].className.replaceAll(" ", ".") : '';

			(function checker(){
				if (!fadercache[identifier]) {
					fadercache[identifier] = true;
					let fadeintv = setInterval(function(){
						opacity += tick;
						el.css({ opacity: opacity / 100 });
						if (opacity === target) {
							clearInterval(fadeintv);
							fadercache[identifier] = undefined;
							resolve();
						}
					},ms||100);
				} else {
					setTimeout(checker, 250);
				}
			})()
		})
	}

	function disabler() {
		$("#btngo").prop("disabled", true);
		$("#settings").prop("disabled", true);

		fader($("#btngo"), -0.1, 1, 0.2);
		fader($("#settings"), -0.1, 1, 0.2);
	}

	function finish(){
		renderProgress(100);
		const pc = $(".progress");
		fader(pc, -0.1, 1, 0).then(function(){
			pc.addClass("d-none");
			pc.css({ opacity: 1 })
		})
		fader($("#btngo"), 0.1, 0.2, 1).then(function(){
			$("#btngo").prop("disabled", false);
		})
		fader($("#settings"), 0.1, 0.2, 1).then(function(){
			$("#settings").prop("disabled", false);
		})
	}

	socket.addEventListener("message", function(event){
		let message = JSON.parse(event.data);
		switch (message.action){
		case "hits":
			renderHits(message);
			break;
		case "stats":
			let spc = Math.round((message.processed / message.total)*10000)/100;
			renderProgress(spc);
			updateHits(message);
			updateValid(message);
			break;
		case "finish":
			running = false;
			updateValid(message);
			updateCountries(message);
			finish();
			break;
		case "begin":
			renderBegin(message);
			break;
		case "subsearch":
			renderEmails(message);
			break;
		case "list":
			renderList(message);
			updateCountries(message);
			break;
		case "history":
			renderHistory(message);
			break;
		case "importing":
			let ipc = Math.round((message.processed / message.total)*10000)/100;
			renderProgress(ipc);
			break;
		case "imported":
			updateValid(message);
			updateCountries(message);
			finish();

			$wait[0].addEventListener('hidden.bs.modal', event=>{
				$wait.modal.dispose();
				$wait.detach();
			});

			$wait.modal.hide();

			if (comboqueue) {
				sendCombos(comboqueue);
				comboqueue = undefined;
			}
			break;
		}
	})

	socket.addEventListener("open", function(event){
		let message = { action: "begin" };
		socket.send(JSON.stringify(message));
	});
	
	$("#search").on("submit", event=>{
		event.preventDefault();
		let term = $("#term").val();
		if (term !== "") {
			searchterm = term;
			let message = {
				action: "search",
				term: searchterm
			};
			submit(message);
			return false;
		}
	})

	$("#extended").on("submit", event=>{
		event.preventDefault();
		let term = $("#advsearch").val();
		if (term !== "") {
			searchterm = term;
			let countries = $("#countrylist").val();
			let mod = $("#module").val();
			let message = {
				action: "search",
				term: searchterm,
				countries
			};
			if (mod !== "*") {
				message.module = mod
			}
			$advanced.modal.hide();
			submit(message);
			return false;
		}
	})

	$("#exre").on("click", event=>{
		$("#extended")[0].reset();
	})

	$("#datasetname").on("submit", event=>{
		event.preventDefault();
		let source = $("#dataset").val();
		if (source !== "") {
			let message = {
				action: "sourcename",
				source
			}
			socket.send(JSON.stringify(message));
		}
		return false;
	})

	function submit(message){
		$("#hitlist").html("");
		addHistory(searchterm);

		renderProgress(0);
		updateValid({ valid: 0 });
		updateHits({ running: "search", hits: 0 });

		$(".progress").removeClass("d-none");
		$("#contains-valid").removeClass("d-none").addClass("d-flex");
		$("#contains-hits").removeClass("d-none").addClass("d-flex");
		$("#term").val("");

		disabler();

		running = true;
		socket.send(JSON.stringify(message));
	}

	let sizehelp;

	function sizesup(){
		if (!sizehelp) {
			sizehelp = $("#sizing").height();
			$("#sizing").detach();
		}

		let rh = $(window).height()-$("#hsplit").position().top;
		let hm = Math.round(rh * 0.35);
		let hb = (rh - (sizehelp * 1.5) - hm);

		$("#contains-hitlist").css({
			height: `${rh}px`
		})
		$("#contains-mail").css({
			height: `${hm}px`
		})
		$("#contains-body").css({
			height: `${hb}px`
		})

		let mb = $("#mailbox").height();
		let bs = $("#mail-barsub").height();
		$("#mail-scroll").css({
			height: `${mb-(bs+sizehelp)}px`
		})
	}

	setTimeout(sizesup,200);

	$(window).on("resize", sizesup);

	let dragholder = {};

	$("body").on("dragenter", ev=>{
		dragholder.background = $("body").css("background-color");
		$("#top").css({ display: "none" });
		$("body").css({ "background-color": "azure" });
	});

	$("body").on("dragleave", ev=>{
		$("#top").css({ display: "block" });
		$("body").css({ "background-color": dragholder.background });
	});

	$("body").on("dragover", ev=>{
		ev.preventDefault();
	})

	function sendCombos(combo){
		let message = {
			action: "combo",
			combo
		};

		$(".progress").removeClass("d-none");
		renderProgress(0);

		$("#contains-valid").removeClass("d-none").addClass("d-flex");
		$("#contains-hits").removeClass("d-flex").addClass("d-none");

		disabler();

		socket.send(JSON.stringify(message));
	}

	$("body").on("drop", ev=>{
		ev.preventDefault();
		$("#top").css({ display: "block" });
		$("body").css({ "background-color": dragholder.background });

		let data = ev.originalEvent.dataTransfer;

		let combo = [];
		let qssess = [];

		function readnext(f) {
			return new Promise(resolve=>{
				let r = new FileReader();
				$(r).on("load", _=>{
					
					if (/\.qssess$/.test(f.name)) {
						qssess = [...combo, ...r.result.trim().split(/\r?\n/)];
						resolve();
					} else if (f.type === "text/plain") {
						combo = [...combo, ...r.result.trim().split(/\r?\n/)];
						resolve();
					} else {
						resolve();
					}
				})
				r.readAsText(f);
				
			})
		}

		let promises = [];
		if (data.files) {
			for (file of [...data.files]) {
				promises.push(readnext(file));
			}
		} else {
			for (item of [...data.items]) {
				if (item.kind === "file") {
					promises.push(readnext(item.getAsFile()));
				}
			}
		}
		
		Promise.all(promises).then(function(){
			let sentqssess = false;

			if (qssess.length > 0) {
				let message = {
					action: "qssess",
					qssess
				};

				$(".progress").removeClass("d-none");
				renderProgress(0);
				disabler();
				renderWait();

				socket.send(JSON.stringify(message));
				sentqssess = true;
			}

			if (combo.length > 0) {
				if (!sentqssess) {
					sendCombos(combo);
				} else {
					comboqueue = combo;
				}
			}

		})

	})

})