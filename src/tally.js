
	import fs from "node:fs"
	import path from "node:path"

	//import { python2json } from './index.js'
	import async from "async"

	import servers from './conf/servers.js'
	import mailblazer from 'mailblazer'

	const resolver = mailblazer().resolve;

	function zf(num, len) {
		let str = `${num}` 
		while (str.length < len) {
			str = "0"+str
		}
		return str
	}

	export function tally() {
		let fn = process.argv[2] || "tally/servers.txt";
		let counter = {};
		let domains = [];
		const text = fs.readFileSync(fn, 'utf8');
		const lines = text.trim().split("\n");
		for (const line of lines) {
			if (!counter[line]) counter[line] = 1
			else counter[line]++
		}

		fs.mkdirSync("tally", { recursive: true });
		for (const key in counter) {
			domains.push(`${zf(counter[key], 5)} ${key}`);
		}

		domains.sort();
		fs.appendFileSync(path.resolve("tally/tally.log"), domains.join("\n"));
		//fs.rmSync(fn)
	}

	function lookup() {
		if (!fs.existsSync(path.resolve("tally/hoster.dat"))){
			let hoster = fs.readFileSync(path.resolve("src/conf/hoster.dat"), "utf-8");
			fs.writeFileSync(path.resolve("tally/hoster.dat"), hoster.trim(), "utf-8");
			console.log("hoster.dat: saved");
		}

		let queue = [];

		function task(line) {
			return function(cb){
				(async()=>{
					console.log(line);
					let parts = line.split(" ");
					let domain = parts[1].toLowerCase();
					if (!servers[domain]){
						let server = await resolver(domain, "info@" + domain);
						if (server) {
							let str = `\n${domain}:${server.hostname}:${server.port}`;
							console.log(server)
							fs.appendFileSync(path.resolve("tally/hoster.dat"), str, "utf-8");
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

		for (let z = lines.length; z > 0; z--) {
			queue.push(task(lines[z-1]));
		}

		async.parallelLimit(queue, 100, function(){
			//python2json();
			console.log("done");
		})
	}

	tally();
	lookup();