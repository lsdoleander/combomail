
import { v4 } from 'uuid';

const MSCV = "sIJkt2ClwstSShBYTMGzvX.20";

function parsecookies(response) {
	let gsch = response.headers.getSetCookie();
	let ckmap = {};
	for (let csh of gsch) {
		let parts = csh.match(/^([^=]*)=([^;]*)/);
		ckmap[parts[1]]=parts[2]
	}
	return ckmap;
}

function writecookies(cookies) {
	let output = ""
	for (let key in cookies) {
		if (output !== "") output += "; ";
		output += `${key}=${cookies[key]}`;
	}
	return output;
}

export default function (sessions) {
	return {
		DOMAINS,
	 	login(user, pass) {
			if (sessions[user]) {
				return factory(user);
			} else {
				return new Promise(async resolve=>{
					try {
						// REQUEST 1
						let url = `https://odc.officeapps.live.com/odc/emailhrd/getidp?hm=1&emailAddress=${user}`;
						const coid = v4();
						let headers = HEADERS.A;
						headers["X-CorrelationId"] = coid;
						let response = await fetch(url, { headers });
						let text = await response.text();
						if (text !== "MSAccount") {
							return resolve ({ error: "Login Failed: !== MSAccount" })
						}

						// REQUEST 2: Get the login URL and required generated values
						let data = POST.B;
						data["login_hint"] = user
						data["uaid"] = coid.replace("-", "")
						url = "https://login.live.com/oauth20_authorize.srf?" + new URLSearchParams(data).toString();
						headers = HEADERS.B;
						headers["correlation-id"] = coid
						headers["client-request-id"] = coid
						response = await fetch(url, { headers })
						let html = await response.text();

						// REQUEST 3
						let refer = response.url.match(/(\S*haschrome=1)/)[1];
						let ppft = html.match(/input[^>]*name\s?=\s?"PPFT"[^>]*value\s?=\s?"([^"]*)"/)[1];
						data = POST.C;
						data["login"] = user
						data["loginfmt"] = user
						data["passwd"] = pass
						data["PPFT"] = ppft
						url = html.match(/urlPost:'([^']*)'/)[1];
						headers = HEADERS.C;
						headers["Referer"] = refer
						let cookie = parsecookies(response);
						headers["Cookie"] = writecookies({
							MSPRequ: cookie["MSPRequ"],
							uaid: cookie["uaid"],
							RefreshTokenSso: cookie["RefreshTokenSso"],
							MSPOK: cookie["MSPOK"],
							OParams: cookie["OParams"],
							MicrosoftApplicationsTelemetryDeviceId: coid
						});

						response = await fetch(url, { method: "post", body: new URLSearchParams(data), redirect: "manual", headers })
						cookie = parsecookies(response);
						const mspcid = cookie["MSPCID"];
						const nap = cookie["NAP"];
						const anon = cookie["ANON"];
						const wlssc = cookie["WLSSC"];

						if (mspcid) {
							let code = response.headers.get("Location").match(/code=([^&]*)&/)[1];
							let cid = mspcid.toUpperCase()
							let n = 0;
							
							// REQUEST 4 OAUTH TOKEN
							url = "https://login.live.com/oauth20_token.srf"
							headers = HEADERS.D;
							data = POST.D;
							data["code"] = code;
							response = await fetch(url, { method: "post", body: new URLSearchParams(data) })
							let jsondata = await response.json();
							const token = jsondata["access_token"];
							if (!token) {
								return resolve({ error: "No Token" });
							} else {
								sessions.save(user, pass, { code, cid, token, nap, anon, wlssc, n });
								return resolve(factory(user));
							}

						} else {
							html = await response.text();

							if (html.includes("error")){
								resolve({ error: "Error Reported" })

							} else if (html.includes("account or password is incorrect")) {
								return resolve({ error: "PASSWORD CHANGE" })

							} else if (html.includes("https://login.live.com/finisherror.srf") ||
								html.includes("https://account.live.com/Abuse") ||
								html.includes("too many times with") ||
								html.includes("/cancel?")){
								
								return resolve({ error: "BLOCKED" })

							} else if (html.includes("https://account.live.com/identity/confirm")){
								return resolve({ error: "CAN BYPASS" })

							} else if (html.includes("https://account.live.com/recover")) {
								return resolve({ error: "2FA" })
							} else {
								resolve({ error: "Unknown" })
							}
						}
					} catch (ex) {
						resolve({ error: ex});
					}
				})
			}
		}
	}

	function factory(user) {

		function tryimage(searchresults, resolve) {
			try {

				// REQUEST 8
				let url = "https://substrate.office.com/imageB2/v1.0/me/image/$value"
				let headers = HEADERS.H;
				headers["Authorization"] = `Bearer ${sessions[user].token}`;
				headers["X-AnchorMailbox"] = `CID:${sessions[user].cid}`;
				headers["X-ClientRequestId"] = sessions[user].coid;
				
				let imgtype;
				fetch(url, { headers }).then(r => {
					imgtype = r.headers.get("content-type");
					return r.arrayBuffer();
				}).then(blob => {
					searchresults.userdata.image = `data:${imgtype};base64,${Buffer.from(blob).toString("base64")}`
				});
			} catch(ex) {
				console.log(ex);

			} finally {
				resolve(searchresults);
			}
		}
		
		function search(searchtext) {
			return new Promise(async resolve=>{
				try {
					// REQUEST 5
					let url = "https://substrate.office.com/profileb2/v2.0/me/V1Profile"
					let headers = HEADERS.E;
					headers["Authorization"] = `Bearer ${sessions[user].token}`
					headers["X-AnchorMailbox"] = `CID:${sessions[user].cid}`
					headers["X-ClientRequestId"] = sessions[user].coid
					let response = await fetch(url, { headers })
					let jsondata = await response.json()

					let userdata = {
						name: jsondata["names"][0]["displayName"],
						country: jsondata["accounts"][0]["location"], 
						birthdate: `${jsondata["accounts"][0]["birthMonth"]}/${jsondata["accounts"][0]["birthDay"]}/${jsondata["accounts"][0]["birthYear"]}`,
						phone: jsondata["phones"][0]["phoneNumber"],
						email: user
					};


					// REQUEST 6
					url = `https://outlook.live.com/owa/${user}/startupdata.ashx?` + new URLSearchParams({
						app: "Mini",
						n: sessions[user]["n"]
					})
					sessions[user]["n"]++;						
					headers = HEADERS.F;
					headers["Authorization"] = `Bearer ${sessions[user].token}`
					headers["x-owa-correlationid"] = sessions[user].coid
					headers["Cookie"] = writecookies({
						ClientId: "B21A0E20632E40438432A219219CAF0A",
						MSPAuth: "Disabled",
						MSPProf: "Disabled",
						NAP: sessions[user].nap,
						ANON: sessions[user].anon,
						WLSSC: sessions[user].wlssc
					})
					response = await fetch(url, { method: "post", headers })
					let cookie = parsecookies(response);
					sessions[user].uc = cookie["UC"];



					// REQUEST 7
					url = "https://outlook.live.com/search/api/v2/query?" + new URLSearchParams({
						cv: MSCV,
						n: sessions[user]["n"]
					})
					sessions[user]["n"]++;
					headers = HEADERS.E;
					headers["Authorization"] = `Bearer ${sessions[user].token}`
					headers["X-AnchorMailbox"] = `CID:${sessions[user].cid}`
					headers["X-ClientRequestId"] = sessions[user].coid
					headers["Content-Type"] = "application/json; charset=utf-8";
					headers["Host"] = "outlook.live.com"
					let data = POST.G;
					data["EntityRequests"][0]["Query"]["QueryString"] = searchtext
					data["AnswerEntityRequests"][0]["Query"]["QueryString"] = searchtext
					response = await fetch(url, { method: "post", body: JSON.stringify(data), headers })
					jsondata = await response.json()

					let searchresults = {
						total: jsondata["EntitySets"][0]["ResultSets"][0]["Total"],
						userdata,
						results: [],
						user
					};

					for (let result of jsondata["EntitySets"][0]["ResultSets"][0]["Results"]){
						searchresults.results.push({
							id: result["Source"]["ItemId"]["Id"],
							subject: result["Source"]["ConversationTopic"],
							attachments: result["Source"]["HasAttachments"],
							date: new Date(result["Source"]["LastDeliveryTime"]).getTime(),
							read: result["Source"]["UnreadCount"] === 0,
							from: {
								name: result["Source"]["From"]["EmailAddress"]["Name"],
								address: result["Source"]["From"]["EmailAddress"]["Address"]
							}
						});
					}

					tryimage(searchresults, resolve);

				} catch(ex) {
					resolve({ error: ex })
				}
			})
		}

		function body(id) {
			return new Promise(async resolve=>{
				try {

					// REQUEST 9
					let url = `https://outlook.live.com/owa/${user}/service.svc?` + new URLSearchParams({
						action: "GetItem",
						app: "Mini",
						n: sessions[user]["n"]
					})
					sessions[user]["n"]++;


					let data = POST.I;
					data["Body"]["ItemIds"][0]["Id"] = id;
					let headers = HEADERS.I;
					headers["Authorization"] = `Bearer ${sessions[user].token}`;
					headers["x-owa-correlationid"] = sessions[user].coid;
					headers["x-owa-urlpostdata"] = encodeURI(JSON.stringify(data));
					headers["Cookie"] = writecookies({
						ClientId: "B21A0E20632E40438432A219219CAF0A",
						MSPAuth: "Disabled",
						MSPProf: "Disabled",
						NAP: sessions[user].nap,
						ANON: sessions[user].anon,
						WLSSC: sessions[user].wlssc,
						UC: sessions[user].uc,
						PPLState: 1
					});
					let response = await fetch(url, { method: "post", headers })
					let jsondata = await response.json()
					resolve(jsondata["Body"]["ResponseMessages"]["Items"][0]["Items"][0]["NormalizedBody"]["Value"])
                        
				} catch(ex) {
					resolve({ error: ex })
				}
			})
		}

		return {
			success: true,
			search,
			user
		}
	}
}

const CLIENT="e9b154d0-7658-433b-bb25-6b8e0a8a7c59",
	SESSIONID=v4();

const OUTLOOKLIVE = {
	"user-agent": "Mozilla/5.0 (Linux; Android 12; sdk_gphone64_x86_64 Build/SE1B.240122.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.193 Mobile Safari/537.36",
	"accept": "*/*",
	"accept-encoding": "gzip, deflate, br",
	"accept-language": "en-US,en;q=0.9",
	"action": "StartupData",
	"ms-cv": MSCV,
	"origin": "https://outlook.live.com",
	"prefer": 'exchange.behavior="IncludeThirdPartyOnlineMeetingProviders"',
	"referer": "https://outlook.live.com/",
	"sec-ch-ua-mobile": "?1",
	"sec-ch-ua-platform": '"Android"',
	"sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Android WebView";v="120"',
	"sec-fetch-dest": "empty",
	"sec-fetch-mode": "cors",
	"sec-fetch-site": "same-origin",
	"x-owa-host-app": "outlook_android",
	"x-owa-hosted-ux": "true",
	"x-owa-sessionid": SESSIONID,
	"x-req-source": "Mail",
	"x-requested-with": "com.microsoft.outlooklite"
};

const HEADERS = {
	A: {
		"X-OneAuth-AppName": "Outlook Lite",
		"X-Office-Version": "3.64.0-minApi22",
		"X-Office-Application": "145",
		"X-OneAuth-Version": "5.5.0",
		"X-Office-Platform": "Android",
		"X-Office-Platform-Version": "32",
		"Enlightened-Hrd-Client": "1",
		"X-OneAuth-AppId": "com.microsoft.outlooklite",
		"User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; sdk_gphone64_x86_64 Build/SE1B.240122.005)",
		"Host": "odc.officeapps.live.com",
		"Connection": "Keep-Alive",
		"Accept-Encoding": "gzip"
	},

	B: {
		"Host": "login.live.com",
		"Connection": "keep-alive",
		"sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Android WebView\";v=\"120\"",
		"sec-ch-ua-mobile": "?1",
		"sec-ch-ua-platform": "\"Android\"",
		"Upgrade-Insecure-Requests": "1",
		"User-Agent": "Mozilla/5.0 (Linux; Android 12; sdk_gphone64_x86_64 Build/SE1B.240122.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.193 Mobile Safari/537.36 PKeyAuth/1.0",
		"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
		"return-client-request-id": "false",
		"x-ms-sso-ignore-sso": "1",
		"x-ms-passkeyauth": "1.0/passkey",
		"x-client-ver": "1.1.0+8aafa8d3",
		"x-client-sku": "MSAL.xplat.android",
		"x-client-os": "32",
		"x-client-src-sku": "MSAL.xplat.android",
		"X-Requested-With": "com.microsoft.outlooklite",
		"Sec-Fetch-Site": "none",
		"Sec-Fetch-Mode": "navigate",
		"Sec-Fetch-User": "?1",
		"Sec-Fetch-Dest": "document",
		"Accept-Encoding": "gzip, deflate, br",
		"Accept-Language": "en-US,en;q=0.9"
	},

	C: {
		"Host": "login.live.com",
		"Connection": "keep-alive",
		"Cache-Control": "max-age=0",
		"Upgrade-Insecure-Requests": "1",
		"Origin": "https://login.live.com",
		"Content-Type": "application/x-www-form-urlencoded",
		"User-Agent": "Mozilla/5.0 (Linux; Android 12; sdk_gphone64_x86_64 Build/SE1B.240122.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.193 Mobile Safari/537.36 PKeyAuth/1.0",
		"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
		"X-Requested-With": "com.microsoft.outlooklite",
		"Sec-Fetch-Site": "same-origin",
		"Sec-Fetch-Mode": "navigate",
		"Sec-Fetch-User": "?1",
		"Sec-Fetch-Dest": "document",
		"Accept-Encoding": "gzip, deflate",
		"Accept-Language": "en-US,en;q=0.9"
	},

	D: {
		"User-Agent": "Mozilla/5.0 (compatible; MSAL 1.0)",
		"Host": "login.live.com",
		"Connection": "keep-alive",
		"x-client-ver": "1.1.0+8aafa8d3",
		"x-client-sku": "MSAL.xplat.android",
		"x-client-os": "32",
		"Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
		"Accept-Encoding": "gzip",
		"return-client-request-id": "false"
	},

	E: {
		"User-Agent": "Outlook-Android/2.0",
		"Pragma": "no-cache",
		"Accept": "application/json",
		"ForceSync": "false",
		"Host": "substrate.office.com",
		"Connection": "Keep-Alive",
		"Accept-Encoding": "gzip"
	},

	F: {
		...OUTLOOKLIVE,
		"action": "StartupData",
		"x-folder-count": "initialfolders",
		"x-js-experiment": "5",
	},

	H: {
		"User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; sdk_gphone64_x86_64 Build/SE1B.240122.005)",
		"Connection": "Keep-Alive",
		"Accept-Encoding": "gzip"
	},

	I: {
		...OUTLOOKLIVE,
		"action": 'GetItem',
		"content-length": '0',
		"content-type": 'application/json; charset=utf-8'
	}
}

const POST = {
	B: {
		"client_id": CLIENT,
		"scope": "profile offline_access openid https://outlook.office.com/M365.Access",
		"redirect_uri": "msauth://com.microsoft.outlooklite/fcg80qvoM1YMKJZibjBwQcDfOno%3D",
		"response_type": "code",
		"x-client-SKU": "MSAL.xplat.android",
		"x-client-Ver": "1.1.0+8aafa8d3",
		"msproxy": "1",
		"issuer": "mso",
		"tenant": "consumers",
		"ui_locales": "en-US",
		"client_info": "1",
		"jshs": "0",
		"haschrome": "1",
		"passKeyAuth": "1.0/passkey"
	},

	C: {
		"13": "1",
		"type": "11",
		"LoginOptions": "1",
		"lrt": "",
		"lrtPartition": "",
		"hisRegion": "",
		"hisScaleUnit": "",
		"ps": "2",
		"psRNGCDefaultType": "",
		"psRNGCEntropy": "",
		"psRNGCSLK": "",
		"canary": "",
		"ctx": "",
		"hpgrequestid": "",
		"PPSX": "PassportR",
		"NewUser": "1",
		"FoundMSAs": "",
		"fspost": "0",
		"i21": "0",
		"CookieDisclosure": "0",
		"IsFidoSupported": "0",
		"isSignupPost": "0",
		"isRecoveryAttemptPost": "0",
		"i19": "9960"
	}, 

	D: {
		"client_info": "1",
		"client_id": CLIENT,
		"redirect_uri": "msauth://com.microsoft.outlooklite/fcg80qvoM1YMKJZibjBwQcDfOno%3D",
		"grant_type": "authorization_code",
		"scope": "profile offline_access openid https://outlook.office.com/M365.Access"
	},

	G: {
	  "Cvid": "de44be69-9bb7-9d93-840f-5e0e6d977164",
	  "Scenario": {
	    "Name": "owa.react"
	  },
	  "TimeZone": "Eastern Standard Time",
	  "TextDecorations": "Off",
	  "EntityRequests": [
	    {
	      "EntityType": "Conversation",
	      "ContentSources": [
	        "Exchange"
	      ],
	      "Filter": {
	        "Or": [
	          {
	            "Term": {
	              "DistinguishedFolderName": "msgfolderroot"
	            }
	          },
	          {
	            "Term": {
	              "DistinguishedFolderName": "DeletedItems"
	            }
	          }
	        ]
	      },
	      "From": 0,
	      "Query": {
	        
	      },
	      "RefiningQueries": null,
	      "Size": 25,
	      "Sort": [
	        {
	          "Field": "Score",
	          "SortDirection": "Desc",
	          "Count": 3
	        },
	        {
	          "Field": "Time",
	          "SortDirection": "Desc"
	        }
	      ],
	      "EnableTopResults": true,
	      "TopResultsCount": 3
	    }
	  ],
	  "AnswerEntityRequests": [
	    {
	      "Query": {
	        
	      },
	      "EntityTypes": [
	        "Event",
	        "File"
	      ],
	      "From": 0,
	      "Size": 10,
	      "EnableAsyncResolution": true
	    }
	  ],
	  "WholePageRankingOptions": {
	    "EntityResultTypeRankingOptions": [
	      {
	        "ResultType": "Answer",
	        "MaxEntitySetCount": 6
	      }
	    ],
	    "DedupeBehaviorHint": 1
	  },
	  "QueryAlterationOptions": {
	    "EnableSuggestion": true,
	    "EnableAlteration": true,
	    "SupportedRecourseDisplayTypes": [
	      "Suggestion",
	      "NoResultModification",
	      "NoResultFolderRefinerModification",
	      "NoRequeryModification",
	      "Modification"
	    ]
	  },
	  "LogicalId": "35d94b1d-8bed-f7bb-e67e-451557d413bc"
	},

	I: {
	  "__type": "GetItemJsonRequest:#Exchange",
	  "Header": {
	    "__type": "JsonRequestHeaders:#Exchange",
	    "RequestServerVersion": "V2018_01_08",
	    "TimeZoneContext": {
	      "__type": "TimeZoneContext:#Exchange",
	      "TimeZoneDefinition": {
	        "__type": "TimeZoneDefinitionType:#Exchange",
	        "Id": "Eastern Standard Time"
	      }
	    }
	  },
	  "Body": {
	    "__type": "GetItemRequest:#Exchange",
	    "ItemShape": {
	      "__type": "ItemResponseShape:#Exchange",
	      "BaseShape": "IdOnly",
	      "AddBlankTargetToLinks": true,
	      "BlockContentFromUnknownSenders": false,
	      "BlockExternalImagesIfSenderUntrusted": true,
	      "ClientSupportsIrm": true,
	      "CssScopeClassName": "rps_9fed",
	      "FilterHtmlContent": true,
	      "FilterInlineSafetyTips": true,
	      "ImageProxyCapability": "OwaAndConnectorsProxy",
	      "InlineImageCustomDataTemplate": "{id}",
	      "InlineImageUrlTemplate": "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAIBTAA7",
	      "MaximumBodySize": 2097152,
	      "MaximumRecipientsToReturn": 20,
	      "AdditionalProperties": [
	        {
	          "__type": "ExtendedPropertyUri:#Exchange",
	          "PropertyName": "EntityExtraction/SmartReplyForEmail",
	          "DistinguishedPropertySetId": "Common",
	          "PropertyType": "String"
	        }
	      ],
	      "InlineImageUrlOnLoadTemplate": ""
	    },
	    "ItemIds": [
	      {
	        "__type": "ItemId:#Exchange",
	        "Id": ""
	      }
	    ],
	    "ShapeName": "ItemNormalizedBody"
	  }
	}
}

export const DOMAINS = [
	"hotmail.at",
	"hotmail.be",
	"hotmail.ca",
	"hotmail.ch",
	"hotmail.cl",
	"hotmail.co",
	"hotmail.co.il",
	"hotmail.co.jp",
	"hotmail.co.kr",
	"hotmail.co.nz",
	"hotmail.co.th",
	"hotmail.co.uk",
	"hotmail.co.za",
	"hotmail.com",
	"hotmail.com.ar",
	"hotmail.com.au",
	"hotmail.com.br",
	"hotmail.com.cn",
	"hotmail.com.es",
	"hotmail.com.fr",
	"hotmail.com.hk",
	"hotmail.com.mx",
	"hotmail.com.sg",
	"hotmail.com.tr",
	"hotmail.com.tw",
	"hotmail.com.uy",
	"hotmail.cz",
	"hotmail.de",
	"hotmail.dk",
	"hotmail.es",
	"hotmail.fi",
	"hotmail.fr",
	"hotmail.gr",
	"hotmail.hu",
	"hotmail.it",
	"hotmail.jp",
	"hotmail.kg",
	"hotmail.kz",
	"hotmail.li",
	"hotmail.lu",
	"hotmail.mx",
	"hotmail.my",
	"hotmail.net.au",
	"hotmail.nl",
	"hotmail.no",
	"hotmail.org",
	"hotmail.pl",
	"hotmail.rs",
	"hotmail.ru",
	"hotmail.se",
	"hotmail.sg",
	"hotmail.us",
	"live.at",
	"live.be",
	"live.ca",
	"live.cl",
	"live.cn",
	"live.co.jp",
	"live.co.kr",
	"live.co.uk",
	"live.co.za",
	"live.com",
	"live.com.ar",
	"live.com.au",
	"live.com.mx",
	"live.com.my",
	"live.com.pt",
	"live.com.sg",
	"live.de",
	"live.dk",
	"live.fr",
	"live.hk",
	"live.ie",
	"live.in",
	"live.it",
	"live.jp",
	"live.nl",
	"live.no",
	"live.ru",
	"live.se",
	"msn.cn",
	"msn.com",
	"msn.fr",
	"msn.nl",
	"outlook.at",
	"outlook.be",
	"outlook.cl",
	"outlook.co.id",
	"outlook.co.il",
	"outlook.co.nz",
	"outlook.co.th",
	"outlook.co.uk",
	"outlook.com",
	"outlook.com.ar",
	"outlook.com.au",
	"outlook.com.br",
	"outlook.com.gr",
	"outlook.com.pe",
	"outlook.com.tr",
	"outlook.com.vn",
	"outlook.cz",
	"outlook.de",
	"outlook.dk",
	"outlook.es",
	"outlook.fr",
	"outlook.hu",
	"outlook.ie",
	"outlook.in",
	"outlook.it",
	"outlook.jp",
	"outlook.kr",
	"outlook.lv",
	"outlook.my",
	"outlook.nl",
	"outlook.ph",
	"outlook.pt",
	"outlook.sa",
	"outlook.sg",
	"outlook.sk",
	"windowslive.com"
]
