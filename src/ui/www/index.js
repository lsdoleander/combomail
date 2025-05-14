
$(()=>{

	const templates = (()=>{
		const $library = $("#template-library").detach();
		return {
			hit: $library.find(".list-group-item").html()
		}
	})()


	const socket = new WebSocket("ws://localhost:8675/saki");

	let data = (()=>{
		let d = localStorage.getItem("data");
		return (d?JSON.parse(d):null) || { searches: [] };
	})();

	function factory(m) {
		return handler(e) {
			m.action = "headers";
			socket.send(JSON.stringify(m));
		}
	}

	function renderHits(message){
		let el = $(templates.hit);
		el.find(".to").text(`${message.newest.to.name||message.newest.to.address} <${message.newest.to.address}>`);
		el.find(".from").text(`${message.newest.from.name||message.newest.from.address} <${message.newest.from.address}>`);
		el.find(".date").text(new Date().setTime(message.newest.date));
		el.find(".hitcounter").text(message.list.size);
		el.find(".subject").text(message.newest.subject);
		$("#hitlist").append(el);
	}

	function renderProgress(message){
		const percent = ((message.processed / message.total)*100).toFixed(2);
		const pb = $(".progress-bar");
		pb.css({ width: `${percent}%` })
		pb.text(`${percent}%`);
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
		}
		console.log(message);
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
		console.log(message);
		socket.send(JSON.stringify(message));
		return false;
	})

	function save(){
		localStorage.setItem("data", JSON.stringify(data))
	}
})