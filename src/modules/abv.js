		
import { v4 } from 'uuid'
import client from 'fetching'
import retryable from './@retryable.js'
import { debuffer, datadir } from 'konsole';

import nord from "../conf/nord.js"
let proxyqueue = nord;

let debug = debuffer(datadir.share("combomail","logs")).logger("abv");

export default function (sessions) {

	return {
		DOMAINS: [ "abv.bg" ],
		queue: "abv",
		name: "abv.bg",
		login
	}
	
	function nextproxy() {
		if (proxyqueue.length === 0) proxyqueue = nord;
		return proxyqueue.pop();
	}
	
	function login(user, pass) {
		let proxy = nextproxy();
	
		function authenticate(){
			return new Promise(async resolve=>{
				if (sessions[user]) {
					let test = await check();
					if (test) {
						return resolve(factory(user));
					} else {
						sessions.delete({ user, pass });
					}
				}

				const { token } = await retryable(resolve, async({ success, fail, newproxy })=>{
					let headers = HEADERS;
					headers["Host"] = "passport.abv.bg";
					headers["Connection"] = "close";

					let data = POST.A;
					data["device_id"] = v4();
					data["username"] = user;
					data["password"] = pass;
					
					let response = await client.post("https://passport.abv.bg/sc/oauth/token", { form: data, headers, proxy, logger:debug });
					let jsondata = await response.json();

					let token = jsondata["access_token"];
					if (postdata["error"] === "unauthorized_user" || !token){
						fail()
					} else {
						success({ token })
					}
				}, { nextproxy })

				sessions.create({ user, pass, module: "abv", session: { token }});
				resolve(factory(user))
			})
		}

		let hits = 0;

		function check() {
			return new Promise(async resolve=>{
				let token = sessions[user];
				let data = "autoreply=1&contacts=1&fid=10&folders=1&foreign_profiles=1&messages=1&pushnotifications=0&quotas=1&settings=1" 
				let headers = HEADERS;
				headers["Connection"] = "close"
				let response = await client.post("https://apis.abv.bg/mobile/sc/bootstrap", { form:data, headers, token, proxy, logger:debug });
				
				resolve(response.ok);
			})
		}

		function userdata() {
			return new Promise(async resolve=>{
				let token = sessions[user];
				let data = "autoreply=1&contacts=1&fid=10&folders=1&foreign_profiles=1&messages=1&pushnotifications=0&quotas=1&settings=1" 
				let headers = HEADERS;
				headers["Connection"] = "close"
				let response = await client.post("https://apis.abv.bg/mobile/sc/bootstrap", { form:data, headers, token, proxy, logger:debug });
				let jsondata = await response.json();
				fs.writeFileSync("abv.user." + hits + ".log", JSON.stringify(jsondata, null, 2));
				resolve();
			})
		}

		function search(searchtext) {
			return new Promise(async resolve=>{
				let token = sessions[user];
				let headers = HEADERS;
				let data = POST.B;
				data["query"] = searchtext
				hits++;

				let response = await client.post("https://apis.abv.bg/mobile/sc/messages/get/list/search", { 
					form:data, headers, token, proxy, logger:debug });
				let jsondata = await response.json();
				fs.writeFileSync("abv.debug." + hits + ".log", JSON.stringify(jsondata, null, 2));
				
				let output = {
					results: [],
					total: 0,
					userdata: await userdata(),
					user
				}
				resolve(output);
			})
		}

		function body(id) {
			return new Promise(async resolve=>{  
				let token = sessions[user];                                                            
				let data = FORMS.D;
				data["msgid"] = id;
				let headers = HEADERS;
				let response = await client.post("https://apis.abv.bg/mobile/sc/message/get", { form:data, headers, token, proxy, logger:debug });
				let html = await response.text();
				fs.writeFileSync("abv.body." + hits + ".log", html);
				resolve({ html });
			})
		}

		function factory(user) {
			return {
				success: true,
				search,
				body
			}
		}

		authenticate();
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