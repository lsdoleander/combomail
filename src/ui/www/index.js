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

	function renderBegin(message){
		updateValid(message);
		
		let list = { action: "list" };
		socket.send(JSON.stringify(list));

		if (message.running) {
			running = true;

			$("#btngo").prop("disabled", true);
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
			em.find(".from").text(`${m.from.name ? m.from.name + ` <${m.from.address}>` : m.from.address}`);
			em.find(".date").text(dateformat(m.date, true));
			em.find(".subject").text(m.subject);
			$("#mail").append(em);

			em.on("click", function(evm){
				$("#mail").find(".list-group-item").removeClass("active");
				em.addClass("active");

				let url = "/body?" + new URLSearchParams({
					user: message.user,
					id: m.id
				});
				
				$("#contains-body").removeClass("d-none");
				iframe.src = url;
			})
		}
	}

	function renderProgress(message){
		const percent = Math.round((message.processed / message.total)*10000)/100;
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

	function renderList(message) {
		let label;
		if (running) {
			label = searchterm;
			shbtn = "info";
		} else {
			label = "[History]";
			shbtn = "secondary";
		}
		let $dropdown = searchtemplate(label, shbtn);
		$("#contains-history").append($dropdown);
		let $ddlist = $("#search-history .dropdown-menu");

		for (let data of message.data) {
			let $option = renderOption(data.term, data.timestamp);
			$ddlist.append($option);
		}
	}

	function renderOption(term, timestamp) {
		let $option = termtemplate(dateformat(timestamp,false,false), term)
		$option.on("click", event=>{
			if (!running && searchterm !== term) {
				let $btn = $("#search-history button.shows-term");
				searchterm = term;
				$btn.text(term);
				if (shbtn === "secondary") $btn.removeClass("bg-secondary-subtle").addClass("bg-info-subtle");
				shbtn = "info";

				let message = {
					action: "history",
					term: term
				}
				socket.send(JSON.stringify(message));
			}
		})
		return $option;
	}

	function addHistory(term) {
		let $ddlist = $("#search-history .dropdown-menu");
		let list = $ddlist.find("li");
		for (let el of list) {
			let compare = $(el).find(".search-term").text();
			if (term.toLowerCase() === compare.toLowerCase()) {
				$(el).detach();
				break;
			}
		}

		let $btn = $("#search-history button.shows-term");
		$btn.text(term);
		if (shbtn === "secondary") $btn.removeClass("btn-secondary").addClass("btn-info");
		shbtn = "info";

		$ddlist.prepend(renderOption(term, new Date()));
	}

	function updateValid(message){
		$("#valid").text(message.valid);
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

	function finish(){
		const pb = $(".progress-bar");
		pb.css({ width: `100%` })
		pb.text(`100%`);
		const pc = $(".progress");
		fader(pc, -0.1, 1, 0).then(function(){
			pc.addClass("d-none");
			pc.css({ opacity: 1 })
		})
		fader($("#btngo"), 0.1, 0.5, 1).then(function(){
			$("#btngo").prop("disabled", false);
		})
	}

	socket.addEventListener("message", function(event){
		let message = JSON.parse(event.data);
		switch (message.action){
		case "hits":
			renderHits(message);
			break;
		case "stats":
			renderProgress(message);
			$("#hits").text(message.hits);
			$("#valid").text(message.valid);
			break;
		case "finish":
			finish();
			running = false;
			break;
		case "begin":
			renderBegin(message);
			break;
		case "subsearch":
			renderEmails(message);
			break;
		case "list":
			renderList(message);
			break;
		case "history":
			renderHistory(message);
			break;
		case "importing":
			renderProgress(message);
			break;
		case "imported":
			updateValid(message);
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
	
	$("#search").submit(function(event){
		event.preventDefault();
		searchterm = $("#term").val();
		addHistory(searchterm);

		$(".progress").removeClass("d-none");
		$("#contains-valid").removeClass("d-none").addClass("d-flex");
		$("#contains-hits").removeClass("d-none").addClass("d-flex");
		$("#term").val("");
		$("#btngo").prop("disabled", true);
		
		fader($("#btngo"), -0.05, 1, 0.5);

		let message = {
			action: "search",
			term: searchterm
		};
		running = true;
		socket.send(JSON.stringify(message));
		return false;
	})

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
		$("#contains-valid").removeClass("d-none").addClass("d-flex");
		$("#contains-hits").removeClass("d-flex").addClass("d-none");
		$("#btngo").prop("disabled", true);
		fader($("#btngo"), -0.05, 1, 0.5);

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
				$("#btngo").prop("disabled", true);
				fader($("#btngo"), -0.05, 1, 0.5);

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