
	import resolver from './resolver/index.js'
	import { python2json } from './index.js'
	import path from "path"	
	import async from "async"
	import fs from "fs"

	import servers from './conf/servers.js'

	let queue = [];
	let hoster = fs.readFileSync(path.resolve("src/conf/hoster.dat"), "utf-8");
	
	function task(line) {
		return function(cb){
			(async()=>{
				let parts = line.split(" ");
				let domain = parts[1].toLowerCase();
				if (!servers[domain]){
					let server = await resolver(domain, "info@" + domain);
					if (server) {
						let str = `\n${domain}:${server.hostname}:${server.port}`;
						console.log(server)
						fs.appendFileSync(path.resolve("hoster.dat"), str, "utf-8");
					} else {
						console.log(domain, " -- Not Found")
					}
				}
				cb();
			})()
		}
	}

	let tally = fs.readFileSync(path.resolve("tally/tally.log"), "utf-8")
	let lines = tally.trim().split(/\r?\n/);
	fs.writeFileSync(path.resolve("tally/hoster.dat"), hoster.trim(), "utf-8");

	for (let z = lines.length; z > 0; z--) {
		queue.push(task(lines[z-1]));
	}

	async.parallelLimit(queue, 50, function(){
		python2json();
		console.log("done");
	})
