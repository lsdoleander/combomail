
	import fs from "fs"
	import path from "path"

	function zf(num, len) {
		let str = `${num}` 
		while (str.length < len) {
			str = "0"+str
		}
		return str
	}

	let domains = {};

	const text = fs.readFileSync(path.resolve("servers.txt"), 'utf8');
	const lines = text.trim().split("\n");
	for (const line of lines) {
		if (!domains[line]) domains[line] = 1
		else domains[line]++
	}

	for (const key in domains) {
		fs.appendFileSync(path.resolve("tally.log"), `${zf(domains[key], 4)} ${key}\n`)
	}
