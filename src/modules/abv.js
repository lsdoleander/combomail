		
import { v4 } from 'uuid';

export default function (sessions) {
	return function login(user, pass){
		if (sessions[user]) {
			return factory(user);
		} else {
			return new Promise(async resolve=>{
				let url = "https://passport.abv.bg/sc/oauth/token";
				let headers = HEADERS;
				headers["Host"] = "passport.abv.bg";
				headers["Connection"] = "close";

				let data = POST.A;
				data["device_id"] = v4();
				data["username"] = user;
				data["password"] = pass;
				
				let response = await fetch(url, { method: "post", body: new URLSearchParams(data).toString(), headers });
				let jsondata = await response.json();

				let token = jsondata["access_token"];
				if (postdata["error"] === "unauthorized_user" || !token){
					resolve ({ success: false })
				}

				sessions.save(user, pass, token);
				resolve(factory(user));
			})
		}
	}

	let hits = 0;

	function factory(user) {
		return {
			success: true,
			search(searchtext) {
				return new Promise(async resolve=>{
					let url = "https://apis.abv.bg/mobile/sc/messages/get/list/search";
					let token = sessions[user];
					let headers = HEADERS.B;
					headers["Authorization"] = `Bearer ${token}`
					let data = POST.B;
					data["query"] = searchtext
					hits++;

					let response = await fetch(url, { method: "post", body: new URLSearchParams(data).toString(), headers });
					let jsondata = await response.json();
					fs.writeFileSync("abv.debug." + hits + ".log", JSON.stringify(jsondata, null, 2));
					
					let output = {
						results: [],
						total: 0,
						user
					}

					url = "https://apis.abv.bg/mobile/sc/bootstrap";
						data = "autoreply=1&contacts=1&fid=10&folders=1&foreign_profiles=1&messages=1&pushnotifications=0&quotas=1&settings=1" 
						headers = HEADERS;
						headers["Connection"] = "close"
					response = await fetch(url, { method: "post", body:data, headers });
					jsondata = await response.json();
					fs.writeFileSync("abv.user." + hits + ".log", JSON.stringify(jsondata, null, 2));
					resolve(output);
				})
			},

			body(id) {
				return new Promise(async resolve=>{
					let url="https://apis.abv.bg/mobile/sc/message/get";
					let data = FORMS.D;
					data["msgid"] = id;
					let headers = HEADERS.D;
					headers["Authorization"] = `Bearer ${token}`
					let response = await fetch(url, { method: "post", body: new URLSearchParams(data).toString(), headers });
					let html = await response.text();
					fs.writeFileSync("abv.body." + hits + ".log", html);
					resolve(html);
				})
			}
		}
	}
}

const HEADERS = {
	"User-Agent": "Mail/2.1.8 (bg.abv.Mail; build:2; iOS 16.0.0) Alamofire/2.1.8",
	"Pragma": "no-cache",
	"Accept": "*/*",
	"Host": "apis.abv.bg",
	"Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
	"Connection": "keep-alive",
	"Accept-Language": "en-CA;q=1.0",
	"Accept-Encoding": "gzip;q=1.0, compress;q=0.5"
}

const POST = {
	A:{
		"app_id": 59831019,
		"client_id": "abv-mobile-apps",
		"grant_type": "nativeclient_password",
		"captcha_challenge": "",
		"os": 1
	},

	B: {
		"filter": "",
		"limit": 25,
		"offset": "",
	},

	D: {
		bodyhtml: 1,
		fid: 10,
		read: 1,
		typeid: 60
	}
}