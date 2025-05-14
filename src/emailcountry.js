{
	const fs = require("fs");
	const path = require("path");
	const domainiac = require("domainiac");

	const text = fs.readFileSync(path.resolve("Valid.txt"), 'utf8');
	const lines = text.trim().split("\n");
	for (const line of lines) {
		const domain = line.match(/^[^@]*@([^:]*):\S*$/)[1];
		const country = domainiac.country(domain);
		fs.appendFileSync(path.resolve(`${country}.txt`), line+"\n");
	}
}