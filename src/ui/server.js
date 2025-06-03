	
import fs from 'fs'
import path from 'path'
import express from 'express';
import ws from 'express-ws';
import cors from 'cors';

import mailserver from '../modules/@mailserver.js';

import launcher from './launcher.js';

const __dirname = import.meta.dirname;

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    console.error("at Promise:");
    console.trace(promise);
});
process.on('uncaughtException', err => {
    console.error('Uncaught Exception');
    console.trace(err);
});

(function start(){

	let app = express();
	app.use(cors());
	app.use(express.json())
	app.use(express.static(path.join(__dirname, 'www')))
	ws(app);

	app.ws("/saki", function(ws, req) {
		let interv, query;

		mailserver.comms({
			hits(data){
				data.action = "hits"
				ws.send(JSON.stringify(data));
			},
			finish(){
				gostats();
				ws.send("{\"action\":\"finish\"}");
				clearInterval(interv);
			}
		})

		function gostats(){
			let data = query.progress();
			data.action = "stats"
			ws.send(JSON.stringify(data));
		}

		ws.on("message", data=>{
			let message = JSON.parse(data);

			if (message.action === "begin"){
				let begin = mailserver.begin();
				ws.send(JSON.stringify(begin.message));
				if (begin.query) {
					query = begin.query;
					interv = setInterval(gostats,500)
				}
				
			} else if (message.action === "search"){
				query = mailserver.search(message);
				interv = setInterval(gostats,500);

			} else if (message.action === "combo"){
				query = mailserver.combo(message);
				interv = setInterval(gostats,500)

			} else if (message.action === "qssess"){
				mailserver.qssess(message).then(imported =>{
				 	ws.send(JSON.stringify(imported))
				});

			} else if (message.action === "subsearch"){
				mailserver.subsearch(message).then(list=>{
					if (list) ws.send(JSON.stringify(list));
				})	
			}
		})
	});

	app.get("/body", (request, response)=>{
		mailserver.body(request.query.user, request.query.id).then(msg=>{
			if (!msg.error) {
				response.set({ "Content-Type": "text/html" });
				response.send(msg.html);
			} else {
				response.set({ "Content-Type": "text/plain" });
				response.send("Error: "+msg.error);
			}
		})
	})

	app.listen(8675);

	setTimeout(function(){
		let ui = launcher("http://localhost:8675/");
		console.log(`UI spawned (browser: ${ui.browser}, PID: ${ui.pid})`);
	500});
})()