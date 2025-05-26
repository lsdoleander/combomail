
	
	import dns from 'node:dns'
	const { Resolver } = dns.promises;

	import { portscan, imap, pop3, webmail, sortServers } from './portscan.js'
	import auto from './autoconf.js'
	import domainiac from 'domainiac'

	let VERBOSE = false;

	async function record(type, domain){
		return new Promise(async resolve=>{
			try {
				const resolver = new Resolver();
				resolver.setServers(['8.8.8.8','1.1.1.1','4.4.4.4']);
				const items = await resolver.resolve(domain,type);
				resolve(items);
			} catch(ex) {
				resolve();
			}
		})
	}

	async function cname(domain){
		return new Promise(async resolve=>{
			let items = await record("CNAME", domain);
			items?.forEach(item=>{if (VERBOSE) console.log("[CNAME]", domain, item)});
			resolve(items?.length===1 ? items[0]: items?.length>1 ? items : null);
		})
	}

	async function srv(domain){
		return new Promise(async resolve=>{
			let output = [];
			let items = await record("SRV", domain);
			items?.forEach(item=>{
				if (item.port > 0 && item.name?.trim() !== "") {
					if (VERBOSE) console.log("[SRV]", domain, item);
					output.push(item);
				}
			});
			resolve(output);
		})
	}

	async function a(domain){
		return new Promise(async resolve=>{
			let items = await record("A", domain);
			items?.forEach(item=>{if (VERBOSE) console.log("[A]", domain, item)});
			resolve(items?.length > 0 ? domain: items);
		})
	}

	function add(data, results, srv) {
		if (results) {
			if (results instanceof Array) {
				for (let a of results) {
					if (srv) {
						if (!data.includes(a.name)) data.push(a.name);
					} else {
						if (!data.includes(a)) data.push(a);
					}
				}
			} else {
				if (!data.includes(results)) data.push(results);
			}
		}
		return data;
	}

	function autodisco(domain, email) {
		return new Promise(async resolve=>{

			// [SRV] autodiscover (Microsoft standard)
			//
			let automs=[ domain ];
			let autodisco = await srv("_autodiscover._tcp."+domain);
			automs = add(automs, autodisco, true);
			
			autodisco = await a("autodiscover."+domain);
			automs = add(automs, autodisco);
			
			autodisco = await cname("autodiscover."+domain);
			automs = add(automs, autodisco);
				
			if (automs.length > 0) {
				for (let conf of automs) {
					let servers = await auto.discover(conf, email);
					if (servers) {
						return sortServers(servers,resolve);
					}
				}
			}
			resolve()
		})
	}

	function autoconf(domain) {
		return new Promise(async resolve=>{

			// [SRV] autoconfig (Mozilla standard)
			//
			let autoconf=[ domain ];
			let autosrv = await srv("_autoconfig._tcp."+domain);
			autoconf = add(autoconf, autosrv, true);
			
			autosrv = await a("autoconfig."+domain);
			autoconf = add(autoconf, autosrv);
			
			autosrv = await cname("autoconfig."+domain);
			autoconf = add(autoconf, autosrv);
				
			if (autoconf.length > 0) {
				for (let conf of autoconf) {
					let servers = await auto.config(conf);
					if (servers) {
						return sortServers(servers,resolve);
					}
				}
			}
			resolve()
		})
	}

	export default function dnsdetector(domain, email){
		return new Promise(async resolve=>{
			if (!domain) return resolve();
			if (domain.trim() === "") return resolve();

			if (VERBOSE) console.log("\n\nDNSdetector", domain);

			// Check for dns service entries for email.
			//
			// [SRV] IMAP
			//
			let srvr = await srv("_imap._tcp."+domain);
			if (srvr.length > 0) {
				srvr.sort(function(a,b){
					return (a.priority < b.priority) ? -1 : 1
				})
				srvr = srvr[0];

				return resolve({ hostname: srvr.name,
					port: srvr.port,
					type: "imap",
					ssl: (srvr.port > 900),
					source: "SRV" });
			}


			// Perform Mozilla autoconfig and Microsoft autodiscover
			let server = await autoconf(domain);
			if (server) return resolve(server);
			
			if (!email) email = `info@${domain}`;
			server = await autodisco(domain, email);
			if (server) return resolve(server);


			// Check for [A] or [CNAME] records for imap(4).domain.com
			// Followed by port scanning these subdomains.
			//
			let scan, imapr = await a("imap."+domain);
			if (!imapr) imapr = await cname("imap."+domain);
			if (!imapr) imapr = await a("imap4."+domain);
			if (!imapr) imapr = await cname("imap4."+domain);
			if (imapr) {
				server = await imap(imapr, "dns");
			} else {
				server = await imap([ "imap."+domain, "imap4."+domain ], "portscan");
			}
			if (server) return resolve(server);
			

			// [A] or [CNAME] mail.domain.com
			// 
			let mailr = await a("mail."+domain);
			if (!mailr) mailr = await cname("mail."+domain);
			if (mailr) {
				server = await portscan(mailr, "dns");
			} else {
				server = await portscan([ domain, "mail."+domain ], "portscan");
			}
			if (server) return resolve(server);
			

			// [A] or [CNAME] webmail.domain.com
			// 
/*			let webmailr = await a("webmail."+domain);
			if (!webmailr) webmailr = await cname("webmail."+domain);
			if (mailr) {
				server = await webmail(webmailr, "dns");
			} else {
				server = await webmail("webmail."+domain, "portscan");
			}
			if (server) return resolve(server);*/
			

			// [A] or [CNAME] pop(3).domain.com
			// 
			let pop3r = await a("pop3."+domain);
			if (!pop3r) pop3r = await cname("pop3."+domain);
			if (!pop3r) pop3r = await a("pop."+domain);
			if (!pop3r) pop3r = await cname("pop."+domain);
			if (pop3r) {
				server = await pop3(pop3r, "dns");
			} else {
				server = await pop3([ "pop3."+domain, "pop."+domain ], "portscan");
			}

			if (!server) {
				let root = domainiac.extract(domain);
				if (root.subdomains.length > 0) {
					server = await dnsdetector(root.domain);
					if (!server && root.subdomains.length === 1) {
						server = await dnsdetector(`${root.subdomains[0]}.mail.${root.domain}`)
					}
				}
			}

			resolve (server);
		})
	}

