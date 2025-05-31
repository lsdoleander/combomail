$(()=>{

	const templates = (()=>{
		return {
			hit: $("#searchresult").detach().html(),
			mail: $("#message").detach().html(),
			message: $("#messagelist").detach().html()
		}
	})()

	const socket = new WebSocket("ws://localhost:8675/saki");

	let searchterm, subterm, fadercache = {};

	function factory(m) {
		return function handler(e) {
			m.action = "headers";
			socket.send(JSON.stringify(m));
		}
	}

	function dateformat(t, long=false){
		const N=new Date().setTime(t);
		const O={month:'2-digit',day:'2-digit',year:'numeric'};
		if (long) O.hour = O.minute = '2-digit';
		F=new Intl.DateTimeFormat('en-US', O),
		P=F.formatToParts(N),
		V=P.map(p=>p.value);
		return (V.join(''));
	}

	function renderBegin(message){
		$("#valid").text(message.valid);
		$("#contains-valid").removeClass("d-none").addClass("d-flex");
		
		if (message.running) {
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

	let iframe = document.getElementById("contains-body");

	$(iframe).on("load", event=>{
		console.log("Iframe Loaded");
		let style = iframe.contentDocument.createElement("style");
		style.textContent = `body {
			margin: 0;
			padding-right: 0.5rem !important;
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
				
				$(iframe).removeClass("d-none");
				iframe.src = url;
			})
		}
	}

	function renderProgress(message){
		const percent = ((message.processed / message.total)*100).toFixed(2);
		const pb = $(".progress-bar");
		pb.css({ width: `${percent}%` })
		pb.text(`${percent}%`);
		$("#valid").text(message.valid);
		if (message.hits) {
			$("#hits").text(message.hits);
		}
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
		if (message.action === "hits") {
			renderHits(message)
		} else if (message.action === "stats") {
			renderProgress(message)
		} else if (message.action === "finish") {
			finish();
		} else if (message.action === "begin") {
			renderBegin(message);
		} else if (message.action === "subsearch") {
			renderEmails(message);
		}
	})

	socket.addEventListener("open", function(event){
		let message = { action: "begin" };
		socket.send(JSON.stringify(message));
	});
	
	$("#search").submit(function(event){
		event.preventDefault();
		searchterm = $("#term").val();
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
		let hb = (rh - sizehelp - hm);

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

	$("body").on("drop", ev=>{
		ev.preventDefault();
		$("#top").css({ display: "block" });
		$("body").css({ "background-color": dragholder.background });

		let data = ev.originalEvent.dataTransfer;

		let combo = [];

		function readnext(f) {
			return new Promise(resolve=>{
				if (f.type === "text/plain") {
					let r = new FileReader();
					$(r).on("load", _=>{
						combo = [...combo, ...r.result.trim().split(/\r?\n/)];
						resolve();
					})
					r.readAsText(f);
				} else {
					resolve();
				}
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
			if (combo.length > 0) {
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
		})

	})

})