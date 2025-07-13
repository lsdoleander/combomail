
import { readdirSync, lstatSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

function template(appentries) {
	return "export default function(app) {" + appentries + "\n}";
}

function fixurlpath(u){
	return (!u || u === "" || u === "/") ? "/" : u.replace(/^\/?(.*)\/?$/,"/"+u+"/");
}

function subdir(dir, url) {
	let urlpath = fixurlpath(url);
	let meat = '';
	let files = readdirSync(dir);
	for (let file of files) {
		let lstat = lstatSync(join(dir,file));
		if (lstat.isDirectory()) {
			meat += subdir(join(dir, file), urlpath + file);
		} else {
			console.log(" - hashing:", join(dir, file));
			let data = readFileSync(join(dir, file));
			let hash = Buffer.from(data).toString('base64');
			if (file === "index.html") {
				meat += "\n  app.get(\"" + urlpath + "\", (q,r)=>{ r.send(atob(\"" + hash + "\")) });"
			}
			meat += "\n  app.get(\"" + urlpath + file + "\", (q,r)=>{ r.send(atob(\"" + hash + "\")) });"
		}
	}
	return meat;
}

export default function statictool(dest, dir, urlpath) {
	console.log(`<application-webui destination="${dest}" dir="${dir}" urlpath="${urlpath===""?"/":urlpath}" />`);
	let data = subdir(dir, urlpath);
	let gen = template(data);
	let destfile = resolve(dest);
	let destdir = destfile.substr(0,destfile.lastIndexOf(sep));
	mkdirSync(destdir, { recursive: true });
	writeFileSync(destfile, gen);
}

statictool(process.argv[2], process.argv[3], process.argv.length > 4 ? process.argv[4] : "")
