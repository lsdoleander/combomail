
import fetching from 'fetching';
import retryable from './@retryable.js'
import { debuffer, datadir } from 'konsole';

let debug = debuffer(datadir.share("combomail","logs")).logger("mailcom");

export default function setup(sessions) {	

	return {
		queue: "main",
		DOMAINS,
		login
	}

	function login(user, pass) {	
		const client = {
			oauth: fetching("https://oauth2.mail.com/"),
			mobsi: fetching("https://mobsi.mail.com/"),
			hsp2: fetching("https://hsp2.mail.com/")
		};
		
		function authenticate(){
			return new Promise(async resolve=>{
				if (sessions[user]) {
					let access_token = sessions[user].access_token;
					let okay = await check(access_token);

					if (okay) {
						return resolve(factory(user))
					} else {
						let refresh_token = sessions[user].refresh_token;
						let result = await refresh(refresh_token);
						if (result.success) {
							let access_token = result.access_token;
							sessions.create({ user, pass, session:{ access_token, refresh_token }});
							return resolve(factory(user));
						} else {
							sessions.delete({ user, pass })
						}
					}
				}

				const { access_token, refresh_token } = await retryable(resolve, async ({ success, fail, retry })=>{
					let headers = HEADERS.A;
					let data = POST.A;
					data["username"] = user;
					data["password"] = pass;

					let response = await client.oauth.post("/token", { form:data, headers });
					let jsondata = await response.json();
					
					let access_token = jsondata["access_token"]
					let refresh_token = jsondata["refresh_token"]
					if (!refresh_token || !access_token) {
						fail();
					} else {
						let result = await refresh(refresh_token);
						if (result.success) {
							access_token = result.access_token;
							success({ access_token, refresh_token })
						} else {
							retry()
						}
					}
				})
				
				sessions.create({ user, pass, session: { access_token, refresh_token }});
				resolve(factory(user));
			})
		}	
		
		function check(token) {
			return new Promise(async resolve=>{
				let headers = HEADERS.D
				let response = await client.mobsi.head("/rest/MobSI/UserData", { headers, token });
				resolve(response.ok);
			})
		}

		function refresh(refresh_token) {
			return new Promise(async resolve=>{
				try {
					let headers = HEADERS.A;
					let data = POST.B;
					data["refresh_token"] = refresh_token;
					let response = await client.oauth.post("/token", { form:data, headers });

					data = POST.C;
					data["refresh_token"] = refresh_token
					response = await client.oauth.post("/token", { form:data, headers });
					let jsondata = await response.json();
					let access_token = jsondata["access_token"]

					if (!access_token) {
						resolve({ success: false, error: "Token Permissions Grant Failed" })
					} else {
						resolve ({ success: true, access_token });
					}
				}  catch(ex) {
					console.log(ex);
				}
			})
		}

		function userdata() {
			return new Promise(async resolve=>{
				if (sessions.userdata[user]) {
					resolve(sessions.userdata[user]);
				} else {
					try {
						let token = sessions[user].access_token;
						let headers = HEADERS.D
						let response = await client.mobsi.get("/rest/MobSI/UserData", { headers, token });
						if (!response.ok) {
							return resolve({ error: "access token expired." })
						}

						let jsondata = await response.json();
						let data = {
							name: `${jsondata["contact"]["firstName"]} ${jsondata["contact"]["lastName"]}`,
							country: jsondata["address"]["countryIso"],
							birthdate: dateformat(new Date(jsondata["details"]["birthDate"]))
						}
						sessions.update({ user, data })
						resolve(data);
					}  catch(ex) {
						console.log(ex);
					}
				}
			})
		}

		function search(searchtext) {
			return new Promise(async resolve=>{
				try {
					let data = POST.E
					let headers = HEADERS.E
					let token = sessions[user].access_token;
					data["include"][0]["conditions"].push(`mail.header:from,replyTo,cc,bcc,to,subject:${searchtext}`)
					let response = await client.hsp2.post("/service/msgsrv/Mailbox/primaryMailbox/Mail/Query?absoluteURI=false", {
						 json: data, headers, token });

					let jsondata = await response.json()

					let searchresults = {
						total: jsondata["totalCount"],
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

					searchresults.userdata = await userdata(),

					resolve(searchresults);
				}  catch(ex) {
					console.log(ex);
				}
			});
		}

		function body(id) {
			return new Promise(async resolve=>{
				try {
					let headers = HEADERS.F;
					let token = sessions[user].access_token;
					let response = await client.hsp2.get (`/service/msgsrv/Mailbox/primaryMailbox/Mail/${id}/Body?absoluteURI=false`,
						{ headers, token });
					let html = await response.text();
					resolve({ html });
				} catch(ex) {
					resolve({ error: ex })
				}
			})
		}

		function factory(user) {
			return {
				success: true,
				search,
				body
			}
		}

		return authenticate();	
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

const _HBASE__ = {
	"Accept-Charset": "utf-8",
	"Accept-Encoding": "gzip",
	"User-Agent": "mailcom.android.androidmail/7.51.2 Dalvik/2.1.0 (Linux; U; Android 12; sdk_gphone64_x86_64 Build/SE1B.240122.005)",
	"X-Ui-App": "mailcom.android.androidmail/7.51.2"
}

const HEADERS = {
	A: {
		"Host": "oauth2.mail.com",
		"Accept": "*/*",
		"Authorization": "Basic bWFpbGNvbV9tYWlsYXBwX2lvczpFcTg3Wlc3VzZ0Vm9mbHFIWXpEVWx4bHZ6MXFOUFpYcGJvS0EwZzd0",
		"Content-Type": "application/x-www-form-urlencoded",
		"Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
		"Connection": "close",
		..._HBASE__
	},

	D: {
		"Host": "mobsi.mail.com",
		"Accept": "application/json",
		"Accept-Language": "en-IN,en-GB;q=0.9,en;q=0.8",
		..._HBASE__
	},

	E: {
		"Host": "hsp2.mail.com",
		"Accept": "application/vnd.ui.trinity.messages+json",
		"Content-Type": "application/vnd.ui.trinity.mailquery+json",
		..._HBASE__
	},

	F: {
		"Host": "hsp2.mail.com",
		"Accept": "text/vnd.ui.insecure+html; removeCharsetMetaInfo=true",
		..._HBASE__
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