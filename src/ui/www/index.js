$(()=>{

	const templates = (()=>{
		return {
			hit: $("#searchresult").detach().html(),
			mail: $("#message").detach().html()
		}
	})()


	const socket = new WebSocket("ws://localhost:8675/saki");

	let data = (()=>{
		let d = localStorage.getItem("data");
		return (d?JSON.parse(d):null) || { searches: [] };
	})();

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
			
			$("#mail").removeClass("d-none");
			
			for (let m of message.results) {
				let em = $(templates.mail);
				em.find(".from").text(`${m.from.name ? m.from.name + ` <${m.from.address}>` : m.from.address}`);
				em.find(".date").text(dateformat(m.date, true));
				em.find(".subject").text(m.subject);
				$("#mail").append(em);

				em.on("click", function(evm){
					$("#mail").find(".list-group-item").removeClass("active");
					$(evm.target).addClass("active");
		
					socket.send(JSON.stringify({
						action: "body",
						user: message.user,
						id: m.id
					}));
				})
			}
		})
	}

	function renderBody(message){
		$("#body").html(message.body);
		$("#body").removeClass("d-none");
	}

	function renderProgress(message){
		const percent = ((message.processed / message.total)*100).toFixed(2);
		const pb = $(".progress-bar");
		pb.css({ width: `${percent}%` })
		pb.text(`${percent}%`);
	}

	function finish(){
		const pb = $(".progress-bar");
		pb.css({ width: `100%` })
		pb.text(`100%`);
	}

	socket.addEventListener("message", function(event){
		let message = JSON.parse(event.data);
		if (message.action === "hits") {
			data.searches[0].hits.push(message)
			renderHits(message)
			save();
		} else if (message.action === "stats") {
			data.searches[0].stats = message
			renderProgress(message)
		} else if (message.action === "finish") {
			finish();
		} else if (message.action === "body") {
			renderBody(message);
		}
	})

	$("#search").submit(function(event){
		event.preventDefault();
		$(".progress").removeClass("d-none");

		let term = $("#term").val();
		data.searches[0] = { term, hits:[] }
		let message = {
			action: "search",
			term
		};
		socket.send(JSON.stringify(message));
		return false;
	})

	function save(){
		localStorage.setItem("data", JSON.stringify(data))
	}

	function sizesup(){
		let rh = $("#top").height()-$("nav.navbar").height();
		let hrh = rh / 2;
		console.log($("#top").height(), $("nav.navbar").height(), rh, hrh);

		let adj = (hrh % 2 > 0) ? 0.5 : 0;
		$("#contains-hits").css({
			height: `${rh}px`
		})
		$("#contains-mail").css({
			height: `${hrh-adj}px`
		})
		$("#contains-body").css({
			height: `${hrh-adj}px`
		})
	}

	setTimeout(sizesup,200);

	$(window).on("resize", sizesup);
})