{
	//const portscanner = require('node-port-scanner');
	const portscanner = require('./portscan');
	const autodiscover = require("./autodiscover");

	const async = require("async");
	const axios = require("axios");	
	const path = require("path");
	const fs = require("fs");

	let domains = fs.readFileSync(path.join(__dirname,"conf/domains.json"));
	let servers = fs.readFileSync(path.join(__dirname,"conf/servers.json"));

	const service = {
		//pop3: require("./pop3"),
		//imap: require("./imap")
	}

	async function exchangeCheck(hostname) {
		try {
			const response = await axios({ method: "head", url: `https://${hostname}/EWS/Exchange.asmx` });
			return response.status < 400;
		} catch(ex) {
			return false;
		}
	}

	async function txt(domain){
		return new Promise(async resolve=>{
			try {
				const resolver = new Resolver();
				resolver.setServers(['8.8.8.8','1.1.1.1','4.4.4.4']);
				const txts = await resolver.resolveTxt(domain);
				
				for (let txt of txts) {
					if (txt[0].indexOf("mailconf") > -1){
						let conf = (txt[0].replace(/mailconf=?/,''));
						if (conf.startsWith("https://")) {
							return resolve(conf);
						} else {
							conf = txt[1];
							if (conf.startsWith("https://")) {
								return resolve(conf);
							}
						}
					} else {
						if (txt[1].indexOf("mailconf") > -1){
							let conf = (txt[1].replace(/mailconf=?/,''));
							if (conf.startsWith("https://")) {
								return resolve(conf);
							} 
						}
					}
				}
				resolve();
			} catch(ex) {
				resolve();
			}
		})
	}

	async function srv(domain){
		return new Promise(async resolve=>{
			try {
			const resolver = new Resolver();
			resolver.setServers(['8.8.8.8','1.1.1.1','4.4.4.4']);
			const srvs = await resolver.resolveSrv(domain);
			
			for (let service of srvs) {
				if ([110,143,993,995].includes(service.port)) {
					return resolve ({
						hostname: service.name,
						type: [110,995].includes(service.port) ? "pop3" : "imap",
						port: service.port,
						ssl: service.port>900,
					})
				} else if (service.port === 443) {
					if (service.name.indexOf("autodiscover") > -1) {
						return resolve({ 
							hostname: service.name,
							type: "exchange",
							mode: "autodiscover",
							port: 443,
							ssl: true 
						})
					} else if (service.name.indexOf("www") < 0) {
						const ews = await exchangeCheck(service.name);
						if (ews) {
							return resolve({ 
								hostname: service.name,
								type: "exchange",
								mode: "ews",
								port: 443,
								ssl: true 
							});
						}
					}
				}
			}
		} catch {
			resolve()
		}
		});
	}

	function splitCombo(combo){
		let parts = combo.split("@");
		let splitAt = parts[1].indexOf(":");
		let username = parts[0];
		let domain = parts[1].substr(0,splitAt).toLowerCase();
		let password = parts[1].substr(splitAt+1);
		return { username, domain, password };
	}

	function resolve(combo){
		let data = splitCombo(combo);
		let host = domains[domain];
		if (host) {
			let server = servers[hostname];
			server.host = host;
			let user = { ...data, host, ...server};
		
		}
	}
	

	async function portscan(dom){
		return new Promise(async resolve=>{
			queue = [];
			servers = []

			function pusher(hostname, port, type, ssl) {
				queue.push(function(cb){
					(async()=>{
						let result = await portscanner(hostname, port);
						if (result) {
							servers.push({ hostname, port, type, ssl })
						}
						cb();
					})()
				})
			}

			function imap(hostname) {
				pusher(hostname, 993, "imap", true)
				pusher(hostname, 143, "imap", false)
			}

			function pop3(hostname) {
				pusher(hostname, 995, "pop3", true)
				pusher(hostname, 110, "pop3", false)
			}

			function webmail(hostname) {
				pusher(hostname, 2096, "webmail", true)
				pusher(hostname, 2095, "webmail", false)
			}

			let parts = dom.split(".")
			if (parts?.length < 2) return resolve()

			else {
				let tld_parts = (parts[parts.length-1].length === 2 && parts[parts.length-2].length === 2)?3:2;
				let sub_mail_tld = parts.length>tld_parts ? [...parts].splice(1,0,"mail").join("."): undefined;
				let no_sub_just_tld = parts.length>tld_parts ? [...parts].splice(0,1).join("."): undefined;
				
				let america_com = (tld_parts > 2) ? [...parts].join(".").replace(parts[parts.length-2]+"."+parts[parts.length-1],"com"): undefined;
				let america_net = (tld_parts > 2) ? [...parts].join(".").replace(parts[parts.length-2]+"."+parts[parts.length-1],"net"): undefined;
				
				function perdom(domain) {
					imap(`imap.${domain}`);
					imap(`mail.${domain}`);
					imap(`imap4.${domain}`);
					imap(`mx.${domain}`);
					imap(domain);

					pop3(`mail.${domain}`);
					pop3(`pop.${domain}`);
					pop3(`pop3.${domain}`);
					pop3(`mx.${domain}`);
					pop3(domain);

					webmail(domain);
					webmail("mail."+domain);
					webmail("webmail."+domain);
				}

				perdom(dom);

				if (sub_mail_tld) {
					imap(sub_mail_tld)
					pop3(sub_mail_tld);
					webmail(sub_mail_tld);
				}

				function sortServers(){
					if (servers.length > 1) {
						servers.sort(function(a,b){
							return a.port > b.port ? -1 : 1
						})
						servers.sort(function(a,b){
							if (a.type !== b.type) {
								return a.type === "imap" ? -1 : a.type === "webmail" ? 1 : -1
							} else {
								return 0;
							}
						})
					}

					if (servers.length > 0) {
						resolve(servers[0])
					} else {
						resolve()
					}
				}

				async.parallel(queue, function(){
					if (servers.length > 0) {
						sortServers()
					} else if (no_sub_just_tld || (america_com && america_net)) {
						if (no_sub_just_tld) perdom(no_sub_just_tld)
						if (america_com && america_net) {
							perdom(america_com)
							perdom(america_net)
						}
						async.parallel(queue, sortServers)
					} else resolve();
				})
			}
		});
	}

	async function checkDomain(domain){
		return new Promise(async resolve=>{
			let server = await srv(domain);
			if (!server) server = await srv("_imap._tcp."+domain)
			if (!server) server = await srv("_pop3._tcp."+domain)
			if (!server) server = await srv("_autodiscover._tcp."+domain)
			if (!server) server = await srv("_autoconfig._tcp."+domain)
			if (!server) {
				confurl = await txt(domain);
				server = await autodiscover(domain, confurl);
			}
			if (!server) server = await portscan(domain)
			if (server) resolve(server)
			else resolve()
		})
	}

	if (module === require.main) {
		(async()=>{
			let domain = process.argv[2];
			let server = await checkDomain(domain);
			if (server) {
				let str = `${domain}:${server.hostname}:${server.port}`;
				console.log(str)
				fs.appendFileSync(path.resolve("servers.log"), str+"\n")
			} else {
				console.log("Not Found")
			}
		})()
	}

	module.exports = {
		checkDomain,
		resolve
	}
}