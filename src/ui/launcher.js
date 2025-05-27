

	import { openSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
	import { execSync, spawn } from "node:child_process"
	import { lookup, kill } from 'ps-node'
	import { join } from 'node:path'

	import datadir from './datadir.js'

	export default function launch(url) {
		function browser(name) {
			console.log(name);
			if (/win/.test(process.platform)) {
				try {
					console.log(`where /Q ${name} /R C:\\`);
					execSync(`where /Q ${name} /R C:\\`)
					return true;
				} catch(ex) {
					return false;
				}
			} else {
				try {
					console.log(`which ${name}`);
					let stdout = execSync(`which ${name}`)
					console.log(stdout);
					return true;
				} catch(ex) {
					return false;
				}
			}
		}

		function findone(){
			for (let b of ["chromium", "chrome", "brave", "msedge", "vivaldi", "opera", "safari", "firefox"]) {
				if (browser(b)) {
					console.log("Found:", b);
					return b;
				} else {
					console.log("No:", b);
				}
			}
		}

		const app = (function init(){
			let dir = datadir("combomail");
			let conf = join(dir, "launch.conf")
			if (existsSync(conf)) {
				return readFileSync(conf,'utf-8');
			} else {
				let b = findone();
				writeFileSync(conf, b, 'utf-8');
				return b;
			}
		})();

		let pid = (function check() {
			lookup({ command: app, arguments: `--app=${url} --new-window` }, (err, list)=>{
				if (list.length === 0) {
					return start();
				} else if (list.length === 1) {
					return list[0].pid;
				} else {
					for (let dupe of list) {
						kill(dupe.pid, (e,d)=>{ if (!e) console.log("killed", dupe.pid) })
					}
					return start();
				}
			});
		})();

		function start() {
			const out = openSync('./browser.log', 'a');
			const err = openSync('./browser.log', 'a');
			let ui = spawn(app, [`--app=${url}`, "--new-window" ],{
			  detached: true,
			  stdio: [ 'ignore', out, err ],
			})
			ui.unref();
			return ui.pid;
		}

		return {
			browser: app,
			running: function() {
				return browser(app);
			},
			pid,
			kill: function() {
				kill(pid);
			}
		}
	}