
import fs from 'fs'

let sessions = {};

export function login (user, pass) {
	if (sessions[user]) {
		return factory(user);
	} else {

		return new Promise(async resolve=>{
			let url = "https://oauth2.mail.com/token"
			let headers = HEADERS.A;
			let data = POST.A;
			data["username"] = user;
			data["password"] = pass;

			let response = await fetch (url, { method: "post", body: new URLSearchParams(data), headers });
			let jsondata = await response.json();
			
			let access_token = jsondata["access_token"]
			let refresh_token = jsondata["refresh_token"]

			if (!refresh_token || !access_token) resolve({ error: "Bad login"})
			


			data = POST.B;
			data["refresh_token"] = refresh_token;
			response = await fetch (url, { method: "post", body: new URLSearchParams(data), headers });
			//jsondata = await response.json();
			//access_token = jsondata["access_token"]

	/*		if (not token1):
				return True, -1, None, "No Token"*/


			data = POST.C;
			data["refresh_token"] = refresh_token
			response = await fetch (url, { method: "post", body: new URLSearchParams(data), headers });
			jsondata = await response.json();
			access_token = jsondata["access_token"]

			if (!access_token) {
				resolve({ error: "Token Permissions Grant Failed" })
			} else {
				sessions[user] = access_token;
				resolve (factory(user));
			}
		})
	}
}

function factory(user) {
	return {
		search(searchtext) {

			return new Promise(async resolve=>{
				let url = "https://mobsi.mail.com/rest/MobSI/UserData"
				let headers = HEADERS.D
				headers["Authorization"] = `Bearer ${sessions[user]}`
				let response = await fetch (url, { headers });
				let jsondata = await response.json();
				let userdata = {
					name: `${jsondata["contact"]["firstName"]} ${jsondata["contact"]["lastName"]}`,
					country: jsondata["address"]["countryIso"],
					birthdate: dateformat(new Date(jsondata["details"]["birthDate"]))
				}

				url = "https://hsp2.mail.com/service/msgsrv/Mailbox/primaryMailbox/Mail/Query?absoluteURI=false"
				let data = POST.E
				headers["Host"] = "hsp2.mail.com"
				headers["Content-Type"] = "application/json"
				data["include"][0]["conditions"].push(`mail.header:from,replyTo,cc,bcc,to,subject:${searchtext}`)
				response = await fetch(url, { method: "post", body: JSON.stringify(data), headers });

				jsondata = await response.json()

				let searchresults = {
					total: jsondata["totalCount"],
					userdata,
					results: [],
					user
				}

				for (let mail of jsondata["mail"]) {
					let from = mail["mailHeader"]["from"];
					let parts = from.match(/\"(.*)\" \<(.*)\>/);
					let m = {
						id: mail["mailURI"],
						subject: mail["mailHeader"]["subject"],
						date: new Date().setTime(mail["mailHeader"]["date"]),
						attachments: mail["attribute"]["hasDownloadableAttachments"],
						read: mail["attribute"]["read"],
						from: {
							address: parts ? parts[2] : from
						}
					}
					if (parts) m.from.name = parts[1];
					searchresults.results.push(m);
				}
	
				resolve(searchresults);
			});
		},

		body(id) {
			return new Promise(resolve=>{
				try {
					let url = `https://hsp2.mail.com/service/msgsrv/Mailbox/primaryMailbox/Mail/${id}/Body?absoluteURI=false`
					let headers = HEADERS.D
					headers["Authorization"] = `Bearer ${sessions[user]}`
					let response = await fetch (url, { headers });
					let html = await response.text();
					resolve(html);
				} catch(ex) {
					resolve({ error: ex })
				}
			})
		}
	}
}

function dateformat(N){
	const O={month:'2-digit',day:'2-digit',year:'numeric'},
	F=new Intl.DateTimeFormat('en-US', O),
	P=F.formatToParts(N),
	V=P.map(p=>p.value);
	return (V.join(''));
}

export const DOMAINS = [
	"2trom.com", "accountant.com", "acdcfan.com", "activist.com", "adexec.com", "africamail.com", "aircraftmail.com", "allergist.com",
	"alumni.com", "alumnidirector.com", "angelic.com", "archaeologist.com", "arcticmail.com", "artlover.com", "asia-mail.com", 
	"asia.com", "atheist.com", "auctioneer.net", "australiamail.com", "bartender.net", "bellair.net", "berlin.com", "bikerider.com", 
	"birdlover.com", "blader.com", "boardermail.com", "brazilmail.com","brew-master.com", "brew-meister.com", "bsdmail.com",
	"californiamail.com", "cash4u.com", "catlover.com", "chef.net", "chemist.com", "chinamail.com", "clubmember.org", "collector.org",
	"columnist.com", "comic.com", "computer4u.com", "consultant.com", "contractor.net", "coolsite.net", "counsellor.com", "cutey.com",
	"cyber-wizard.com", "cyberdude.com", "cybergal.com", "cyberservices.com", "dallasmail.com", "dbzmail.com", "deliveryman.com",
	"diplomats.com", "disciples.com", "discofan.com", "disposable.com", "doglover.com", "doramail.com", "dr.com", "dublin.com", 
	"dutchmail.com", "elvisfan.com", "email.com", "engineer.com", "englandmail.com", "europe.com", "europemail.com", "execs.com", 
	"fastservice.com", "financier.com", "fireman.net", "galaxyhit.com", "gardener.com", "geologist.com", "germanymail.com", 
	"graduate.org", "graphic-designer.com", "greenmail.net", "groupmail.com", "hackermail.com", "hairdresser.net", "hilarious.com", 
	"hiphopfan.com", "homemail.com", "hot-shot.com", "housemail.com", "humanoid.net", "iname.com", "innocent.com", "inorbit.com", 
	"instruction.com", "instructor.net", "insurer.com", "irelandmail.com", "israelmail.com", "italymail.com", "job4u.com", 
	"journalist.com", "keromail.com", "kissfans.com", "kittymail.com", "koreamail.com", "legislator.com", "linuxmail.org", 
	"lobbyist.com", "lovecat.com", "madonnafan.com", "mail-me.com", "mail.com", "marchmail.com", "metalfan.com", "mexicomail.com", 
	"minister.com", "moscowmail.com", "munich.com", "musician.org", "muslim.com", "myself.com", "net-shopping.com", "ninfan.com", 
	"nonpartisan.com", "null.net", "nycmail.com", "optician.com", "orthodontist.net", "pacific-ocean.com", "pacificwest.com", 
	"pediatrician.com", "petlover.com", "photographer.net", "physicist.net", "planetmail.com", "planetmail.net", "polandmail.com", 
	"politician.com", "post.com", "presidency.com", "priest.com", "programmer.net", "protestant.com", "publicist.com", 
	"qualityservice.com", "radiologist.net", "ravemail.com", "realtyagent.com", "reborn.com", "reggaefan.com", "registerednurses.com",
	"reincarnate.com", "religious.com", "repairman.com", "representative.com", "rescueteam.com", "rocketship.com", "safrica.com", 
	"saintly.com", "salesperson.net", "samerica.com", "sanfranmail.com", "scotlandmail.com", "secretary.net", "snakebite.com",
	"socialworker.net", "sociologist.com", "solution4u.com", "songwriter.net", "spainmail.com", "surgical.net", "swedenmail.com", 
	"swissmail.com", "teachers.org", "tech-center.com", "techie.com", "technologist.com", "theplate.com", "therapist.net", 
	"toke.com", "toothfairy.com", "torontomail.com", "tvstar.com", "umpire.com", "usa.com", "uymail.com", "webname.com", 
	"worker.com", "workmail.com", "writeme.com"
];

const HEADERS = {
	A: {
		"Host": "oauth2.mail.com",
		"Accept": "*/*",
		"Authorization": "Basic bWFpbGNvbV9tYWlsYXBwX2lvczpFcTg3Wlc3VzZ0Vm9mbHFIWXpEVWx4bHZ6MXFOUFpYcGJvS0EwZzd0",
		"Content-Type": "application/x-www-form-urlencoded",
		"X-Ui-App": "mailcom.ios.iosmail/8.42.6176",
		"User-Agent": "mail.com/6176 CFNetwork/1399 Darwin/22.1.0",
		"Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
		"Accept-Encoding": "gzip, deflate",
		"Connection": "close" 
	},

	D: {
		"Host": "mobsi.mail.com",
		"Accept": "application/json",
		"Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
		"Accept-Encoding": "gzip, deflate",
		"X-Ui-App": "mailcom.ios.iosmail/8.42.6176",
		"User-Agent": "mail.com/6176 CFNetwork/1399 Darwin/22.1.0" 
	}

}

const POST = {
	A: {
		"grant_type": "password",
		"device_name": "iOS_Device"
	},

	B: {
		"grant_type": "refresh_token",
		"scope": "context"
	},

	C: {
		"scope": "mailbox_user_full_access mailbox_user_status_access hsp_user_full_access onlinestorage_user_meta_read onlinestorage_user_meta_write foo bar",
		"grant_type": "refresh_token"
	},

	E: {
	    "amount": 25,
	    "excludeFolderTypeOrId": [
	        "SPAM",
	        "TRASH",
	        "DRAFTS",
	        "OUTBOX"
	    ],
	    "include": [{ "conditions": [] }],
	    "orderBy": "INTERNALDATE desc",
	    "preferAbsoluteURIs": false
	}

}

export default {
	DOMAINS,
	login
}
