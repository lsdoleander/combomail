
import nord from "../conf/nord.js"

let proxy, proxyqueue = proxy = [ ...nord ];

export function nextproxy() {
//	if (proxyqueue.length === 0) proxyqueue = proxy;
//	return proxyqueue.pop();
	return null;
}
