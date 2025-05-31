

	import { openSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
	import { execSync, spawn } from "node:child_process"
	import { lookup, kill } from 'ps-node'
	import { join } from 'node:path'

	import datadir from './datadir.js'

	export default function launch(url) {
		function browser(name) {
			let buff;
			if (/win/.test(process.platform)) {
				try {
					buff = execSync(`where ${name}.exe /R C:\\`);
				} catch(ex) {
					return false;
				}
			} else {
				try {
					buff = execSync(`which ${name}`);
				} catch(ex) {
					return false;
				}
			}
			if (buff) {
				let stdout = buff.toString("utf-8")
				let parts = stdout.trim().split(/\r?\n/);
				if (parts.length > 0) return parts[0]
				else return stdout.length > 0 ? stdout : null
			}
		}

		function findone(){
			for (let b of ["msedge", "chromium", "chrome", "brave", "vivaldi", "opera", "safari", "firefox"]) {
				let exe = browser(b);
				if (exe) {
					console.log("Found:", exe);
					return exe;
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
			lookup({ command: app, arguments: `--kiosk=${url} --new-window` }, (err, list)=>{
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
		//	const err = openSync('./browser.log', 'a');
			let ui = spawn(app, [`--kiosk=${url}`, "--new-window" ],{
			  detached: true,
			  stdio: [ 'ignore', out, out ],
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