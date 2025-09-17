
import decodo from "../conf/decodo.js"
import floxy from "../conf/floxy.js"
import nord from "../conf/nord.js"

let proxy, proxyqueue = proxy = [ ...nord, ...decodo, ...floxy ];

export function nextproxy() {
	if (proxyqueue.length === 0) proxyqueue = proxy;
	return proxyqueue.pop();
}
