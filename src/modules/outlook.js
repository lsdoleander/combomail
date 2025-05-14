	import { v4 } from 'uuid';
	import fs from 'fs';

	function parsecookies(response) {
		let gsch = response.headers.getSetCookie();
		let ckmap = {};
		for (let csh of gsch) {
			let parts = csh.match(/([^=]*)=([^;]*)/);
			ckmap[parts[0]]=parts[1]
		}
		return ckmap;
	}

	export default function(user, pass) {
		return new Promise(resolve=>{

			// REQUEST 1
			let url = `https://odc.officeapps.live.com/odc/emailhrd/getidp?hm=1&emailAddress=${user}`;
			const coid = v4();
			let headers = HEADERS.A;
			headers["X-CorrelationId"] = coid;
			let response = await fetch(url, { headers });
			let text = await response.text();
			if (text !== "MSAccount") {
				return resolve ()
			}



			// REQUEST 2: Get the login URL and required generated values
			let data = POST.A;
			data["login_hint"] = user
			data["uaid"] = coid.replace("-", "")
			url = "https://login.live.com/oauth20_authorize.srf?" + new URLSearchParams(data).toString();
			headers = HEADERS.B;
			headers["correlation-id"] = coid
			headers["client-request-id"] = coid
			response = await fetch(url, { headers })
			html = await response.text();



			// REQUEST 3
			let refer = response.url.match(/(\S*haschrome=1)/)[1];
			let ppft = html.match(/input[^>]*name\s?=\s?"PPFT"[^>]*value\s?=\s?"([^"]*)"/)[1];
			data = POST.B;
			data["login"] = user
			data["loginfmt"] = user
			data["passwd"] = pass
			data["PPFT"] = ppft
			url = html.match(/urlPost:'([^']*)'/)[1];
			url += (url.includes("?") ? "&" : "?") + new URLSearchParams(data).toString();
			headers = HEADERS.C;
			headers["Referer"] = refer
			let cookie = parsecookies(response);
			let cookies = {
				"MSPRequ": cookie["MSPRequ"],
				"uaid": cookie["uaid"],
				"RefreshTokenSso": cookie["RefreshTokenSso"],
				"MSPOK": cookie["MSPOK"],
				"OParams": cookie["OParams"],
				"MicrosoftApplicationsTelemetryDeviceId": coid
			}
			headers["Cookie"] = new URLSearchParams(cookies).toString();
			response = await fetch(url, { method: "post", body: data, redirect: "manual", headers })
			html = await response.text();
			cookie = parsecookies(response);
			if (html.includes("error") || html.includes("account or password is incorrect") || 
				html.includes("https://account.live.com/identity/confirm") ||
				html.includes("https://account.live.com/Consent/Update") ||
				html.includes("https://account.live.com/recover") ||
				html.includes("https://login.live.com/finisherror.srf") ||
				html.includes("https://account.live.com/Abuse") ||
				html.includes("too many times with")){
				return resolve()
			}
			const code = response.headers.get("Location").match(/code=([^&]*)&/)[1];
			const mspcid = cookie["MSPCID"]
			const cid = mspcid.toUpperCase()



			// REQUEST 4 OAUTH TOKEN
			url = "https://login.live.com/oauth20_token.srf"
			data = POST.C;
			data["code"] = code
			headers = HEADERS.C;
			response = await fetch(url, { method: "post", body:data, headers })
			let jsondata = await response.json();
			const token = jsondata["access_token"];
			if (!token) return resolve();



			// REQUEST 5 
			url = "https://substrate.office.com/profileb2/v2.0/me/V1Profile"
			headers = HEADERS.D;
			headers["X-AnchorMailbox"] = `CID:${cid}`
			headers["Authorization"] = `Bearer ${token}`
			response = await fetch(url, { headers })
			jsondata = await response.json()
			let text = await response.text();
			fs.writeFileSync("debug2.json", text);
			//userdata = f'name: {jsondata["names"][0]["displayName"]}, country: {jsondata["accounts"][0]["location"]}, birthdate: {jsondata["accounts"][0]["birthMonth"]}/{jsondata["accounts"][0]["birthDay"]}/{jsondata["accounts"][0]["birthYear"]}'


			// REQUEST 6
			url = "https://outlook.live.com/search/api/v2/query?n=77&cv=eSotKRVAPH%2BHR0JglL8Hdj.85"
			data = POST.D;
			data["EntityRequests"][0]["Query"]["QueryString"] = searchtext
			data["AnswerEntityRequests"][0]["Query"]["QueryString"] = searchtext
			response = requests.post(url, json=data, headers=headers,proxies=proxies)
			jsondata = response.json()
			total = jsondata["EntitySets"][0]["ResultSets"][0]["Total"]
			lastdate = None

			if total > 0:
				text = await response.text();
				fs.writeFileSync("debug2.json", response.text);

		})
	}

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
			"User-Agent": "Outlook-Android/2.0",
			"Pragma": "no-cache",
			"Accept": "application/json",
			"ForceSync": "false",
			"Host": "substrate.office.com",
			"Connection": "Keep-Alive",
			"Accept-Encoding": "gzip"
		}
	}

	const POST = {
		A: {
			"client_id": "e9b154d0-7658-433b-bb25-6b8e0a8a7c59",
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
		B: {
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
		C: {
			"client_info": "1",
			"client_id": "e9b154d0-7658-433b-bb25-6b8e0a8a7c59",
			"redirect_uri": "msauth://com.microsoft.outlooklite/fcg80qvoM1YMKJZibjBwQcDfOno%3D",
			"grant_type": "authorization_code",
			"scope": "profile offline_access openid https://outlook.office.com/M365.Access"
		},
		D: {
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
		}
	}