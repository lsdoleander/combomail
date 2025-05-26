
	import path from "path"
	import fs from "fs"
	import JSON5 from 'json5'

	export function python2json(){
		let hosters = fs.readFileSync(path.resolve("tally/hoster.dat"), "utf-8").trim().split(/\r?\n/);
		let dat_tree;
		for (let entry of hosters) {
			let parts = entry.match(/(.*):(.*):(.*)/);
			if (parts) {
				if (!dat_tree) dat_tree = "export default {\n";
				else dat_tree += ",\n";
				dat_tree += `\t"${parts[1]}": [ "${parts[2]}", ${parts[3]} ]`;
			}
		}
		dat_tree += "\n}\n";
		fs.writeFileSync("tally/servers.js", dat_tree);
	}

	export function json2python(){
		let domains = JSON5.parse(fs.readFileSync(path.resolve("tally/servers.js"), "utf-8").replace("export default ",""));
		let dat_tree = [];
		for (let domain in domains){
			dat_tree.push(`${domain}:${domains[domain][0]}:${domains[domain][1]}`);
		}
		fs.writeFileSync("tally/hoster.dat", dat_tree.join("\n"));
	}

	python2json()