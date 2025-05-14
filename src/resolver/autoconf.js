
	import { load } from "cheerio"; 

	let VERBOSE = false;

	function parse(xml,domain) {
		if (VERBOSE) console.log(xml);
		let servers = [];

		try{
			const $ = load(xml);
			let match = $("incomingServer");
			for (let mserver of match) {
				let firstServer = $(mserver);
				servers.push({ 
					type: firstServer.attr("type"),
					hostname: firstServer.find("hostname").text().replace("%EMAILDOMAIN%", domain),
					port: firstServer.find("port").text(),
					ssl: firstServer.find("socketType")?.text() !== "plain",
					source: "autoconfig"
				})
			}
			return servers;
		} catch(ex) {
			if (VERBOSE) console.log(ex);
		}
	}

	function check(u,d) {
		return new Promise(async resolve=>{
			try {
				let respo = await fetch(u)
				if (respo.ok) {
					if (VERBOSE) console.log(u,"\n",respo.headers.get("Content-Type"));
					if (/(text|application)\/xml/.test(respo.headers.get("Content-Type"))) {
						let text = await respo.text();
						let service = parse(text,d);
						if (service) {
							if (VERBOSE) console.log(`<autoconfig type='application/xml' url='${u}'/>`);
							resolve(service);
						} 
					}
				} else {
					if (VERBOSE) console.log(u,"\n", respo.status)
				}
			} catch(ex) {
				if (VERBOSE) console.log(u,"\n", ex.message);
			}

			resolve()
		});
	}

	export function config(domain) {
		return new Promise(async resolve=>{
			let server = await check("https://" + domain + "/mail/config-v1.1.xml",domain);
			if (!server) server = await check("https://"+domain+"/.well-known/autoconfig/mail/config-v1.1.xml",domain);
			if (server) resolve(server); 
			resolve();
		})
	}

	function post(email) {
		return `<?xml version="1.0" encoding="utf-8"?>
		<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/requestschema/2006">
		  <Request>
		    <AcceptableResponseSchema>http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a</AcceptableResponseSchema>
		    <EMailAddress>${email}</EMailAddress>
		  </Request>
		</Autodiscover>`;
	}

	function pdisco(xml) {
		if (VERBOSE) console.log(xml);
		let servers = [];

		try{
			const $ = load(xml);
			let match = $("Protocol");
			for (let mserver of match) {
				let firstServer = $(mserver);
				let type = firstServer.find("Type").text().toLowerCase();
				if (type !== "smtp") {
					servers.push({
						type,
						hostname: firstServer.find("Server").text(),
						port: firstServer.find("Port").text(),
						ssl: firstServer.find("SSL")?.text() === "on",
						source: "autodiscover"
					})
				}
			}
			return servers;
		} catch(ex) {
			if (VERBOSE) console.log(ex);
		}
	}

	export function discover(domain, email){
		return new Promise(async resolve=>{
			const u = "https://" + domain + "/autodiscover/autodiscover.xml";
			const xml = post(email);

			try {
				let respo = await fetch(u, {
					method: "POST",
					body: xml
				});
				if (respo.ok) {
					if (VERBOSE) console.log(u,"\n",respo.headers.get("Content-Type"));
					if (/(text|application)\/xml/.test(respo.headers.get("Content-Type"))) {
						let text = await respo.text();
						let service = pdisco(text);
						if (service) {
							if (VERBOSE) console.log(`<autodiscover type='application/xml' url='${u}'/>`);
							resolve(service);
						}
					}
				} else {
					if (VERBOSE) console.log(u,"\n", respo.status)
				}
			} catch(ex) {
				if (VERBOSE) console.log(u,"\n", ex.message);
			}

			resolve(); 
		})
	}

	export default {
		config, discover
	}
