		
	import { v4 } from 'uuid';
	import fs from 'fs';

	export function login(user, pass){
		if (sessions[user]) {
			return factory(user);
		} else {
			return new Promise(resolve=>{
				let url = "https://passport.abv.bg/sc/oauth/token";
				let headers = HEADERS.A;
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

				sessions[user] = token;
				resolve(factory(user));
			})
		}
	}

	let hits = 0;

	function factory {
		return {
			search(searchtext) {
				return new Promise(resolve=>{
/*					let url = "https://apis.abv.bg/mobile/sc/messages/get/list";
				headers = headerlist("2", "configs/abvbg")
				headers["Authorization"] = "Bearer {token}"
				response = session.get(urlpost, headers=headers,proxies=proxies)
				debug(hits + "a", response.text)*/

				let url = "https://apis.abv.bg/mobile/sc/messages/get/list/search";
				let headers = HEADERS.B;
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

				resolve(output);
			}
		}
	}

	const HEADERS = {
		A: {
			"Accept-Encoding": "gzip, deflate, br",
			"Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
			"Connection": "close",
			"User-Agent": "Dalvik/2.1.0 (Linux; U; Android 13; SM-G977N Build/PQ3A.190705.003)",
			"Host": "passport.abv.bg"
		},

		B: {
			"User-Agent": "Mail/2.1.8 (bg.abv.Mail; build:2; iOS 16.0.0) Alamofire/2.1.8",
			"Pragma": "no-cache",
			"Accept": "*/*",
			"Host": "apis.abv.bg",
			"Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
			"Connection": "keep-alive",
			"Content-Length": "32",
			"Accept-Language": "en-US;q=1.0, ar-FR;q=0.9",
			"Accept-Encoding": "gzip;q=1.0, compress;q=0.5"
		}
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
			"limit": 200,
			"offset": "",
		}
	}