import { v4 } from 'uuid'
import client from 'fetching'
import retryable from './@retryable.js'
import { debuffer, datadir } from 'konsole'
import { nextproxy } from "./@proxy.js"

let debug = debuffer(datadir.share("combomail","logs")).logger("aol");

const DOMAINS = [
	"aim.com", "aol.com"
]

export default function setup(sessions) {	

	return {
		queue: "main",
		name: "mail.com",
		DOMAINS,
		login
	}

	function fingerprint(){
		let unix = new Date().getTime();

		const gpulist = [
			"Google Inc. (Mesa)~ANGLE (Mesa, Vulkan 1.4.311 (llvmpipe (LLVM 19.1.7 256 bits) (0x00000000)), llvmpipe)",
			"ANGLE (AMD Radeon(TM) R3 Graphics Direct3D11 vs_5_0 ps_5_0),desktop,78,39,0,0.00",
			"ANGLE (NVIDIA GeForce GTX 880M Direct3D11 vs_5_0 ps_5_0),desktop,8,2,0,0.00",
			"ANGLE (NVIDIA GeForce GTX 860M Direct3D11 vs_5_0 ps_5_0),desktop,6,2,0,0.00",
			"ANGLE (NVIDIA GeForce GTX 960M Direct3D9Ex vs_3_0 ps_3_0),desktop,6,2,0,0.00",
			"ANGLE (NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0),desktop,4,2,0,0.00"
		]
	}

	function login(user, pass, domain, country) {
		let proxy = nextproxy();

		async function authenticate(){
			let data1 = await retryable(resolve, async({ success,fail,retry,newproxy })=>{
				client.get("https://mail.aol.com", { headers: BASIC, proxy }).then(async response=>{
					if (response.error) retry();
					if (response.ok && response.supports.dom) {
						const $ = await response.dom();
						const cookies = {
							A1: response.cookies.A1,
							A1S: response.cookies.A1S,
							A3: response.cookies.A3
						};
						const a = $("a.login");
						if (a) {
							const uri = a.attr("href");
							success({ cookies, uri });
						} else retry();
					}
				}).catch(retry)
			}, { logsto: debug, nextproxy })

			const AS = await retryable(resolve, async({ success,fail,retry,newproxy })=>{
				client.get(data1.uri, { cookies: data1.cookies, headers: BASIC, proxy }).then(async response=>{
					if (response.error) retry();
					if (response.ok && response.supports.dom) {
						const $ = await response.dom();
						let form = {
							crumb: $("input[name='crumb']"),
							acrumb: $("input[name='acrumb']"),
							sessionIndex: $("input[name='sessionIndex']"),

						}
					}
				}).catch(retry)
			}, { logsto: debug, nextproxy })
		}
	}
}

const BASIC = {
	"cache-control": "max-age=0",
	"sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Microsoft Edge";v="138"',
	"sec-ch-ua-mobile": "?0",
	"sec-ch-ua-platform": "\"Linux\"",
	"upgrade-insecure-requests": '1',
	"user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
	"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
	"sec-fetch-site": "none",
	"sec-fetch-mode": "navigate",
	"sec-fetch-user": "?1",
	"sec-fetch-dest": "document",
	"accept-encoding": "gzip, deflate, br, zstd",
	"accept-language": "en-US,en;q=0.9",
	"priority": "u=0, i"
}

const HEADERS = {

}