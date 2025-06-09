

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
					//console.log("No:", b);
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

		let prid = (function check() {
			return new Promise(resolve=>{
				lookup({ command: app, arguments: "combomail" }, async (err, list) => {
					if (list.length === 0) {
						console.log("lookup: ui not running... start!")
						let p = await start();
						resolve(p);
					} else if (list.length === 1) {
						console.log("lookup: ui already running, go!")
						resolve( list[0].pid );
					} else {
						for (let dupe of list) {
						console.log("lookup: kill stale ui process:", dupe.pid);
							kill(dupe.pid, (e,d)=>{ if (!e) console.log("killed", dupe.pid) })
						}
						console.log("lookup: now re, we-start!")
						let p = await start();
						resolve(p);
					}
				});
			});
		})();

		function start() {
			return new Promise(resolve=>{
				const out = openSync('./browser.log', 'a');
				const ui = spawn(app, [`--app=${url}`, "--new-window", "--window-name=combomail", "--ash-enable-night-light",
					"--disable-background-mode", "--disable-sync", "--disable-plugins" ],{
				  //detached: true,
				  stdio: [ 'ignore', out, out ],
				})
				setTimeout(async function(){
					let pid = ui.pid;
					if (!pid) (function check() {
						lookup({ command: app, arguments: "--window-name=combomail" }, (err, list)=>{
							if (list) resolve(list[list.length-1]);
							else resolve();
						})
					})();
				},5000)
			})
		}

		const closebrowser = ()=>{
			kill(pid, (e,d)=>{
				process.exit();
			})
		};

		process.on("SIGINT", closebrowser);
		process.on("SIGHUP", closebrowser);
		process.on("SIGTERM", closebrowser);
		process.on("SIGBREAK", closebrowser);

		return {
			browser: app,
			running: function() {
				return browser(app);
			},
			pid: async function(){
				return prid;
			},
			kill: function() {
				kill(pid);
			}
		}
	}