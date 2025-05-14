	
	import fs from 'fs'
	import path from 'path'
	import express from 'express';
	import ws from 'express-ws';
	import cors from 'cors';

	import mailserver from '../modules/mailserver.js'
	
	const __dirname = import.meta.dirname;

	(function start(){

		let app = express();
		app.use(cors());
		app.use(express.json())
		app.use(express.static(path.join(__dirname, 'www')))
		ws(app);

		app.ws("/saki", function(ws, req) {
			ws.on("message", data=>{
				let message = JSON.parse(data);

				if (message.action === "search"){
					let opt = {
						term: message.term,
						hits(data){
							data.action = "hits"
							ws.send(JSON.stringify(data));
						},
						finish(){
							ws.send("{action:\"finish\"}");
							clearInterval(interv);
						}
					}
					
					let query = mailserver.search(opt);
					let interv = setInterval(function(){
						let data = query.progress();
						data.action = "stats"
						ws.send(JSON.stringify(data));
					},5000)
				}
			})
		});

		app.listen(8675);
	})()