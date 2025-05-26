
	import fs from "fs"
	import path from "path"

	function zf(num, len) {
		let str = `${num}` 
		while (str.length < len) {
			str = "0"+str
		}
		return str
	}

	let counter = {};
	let domains = [];
	const text = fs.readFileSync(path.resolve("servers.txt"), 'utf8');
	const lines = text.trim().split("\n");
	for (const line of lines) {
		if (!counter[line]) counter[line] = 1
		else counter[line]++
	}

	fs.mkdirSync("tally", { recursive: true });
	for (const key in counter) {
		domains.push(`${zf(domains[key], 4)} ${key}`);
	}

	domains.sort();
	fs.appendFileSync(path.resolve("tally/tally.log"), domains.join("\n"));
	fs.rmSync(path.resolve("servers.txt"))
