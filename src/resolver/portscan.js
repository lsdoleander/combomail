
    import { Socket } from "net"
    import { createSocket } from "node:dgram"
    import async from "async"

    let VERBOSE = false

    function portscanner (host, port) {
        return new Promise((resolve, reject) => {    
            function udp(){
                const socket = createSocket("udp4")

                socket.on('connect', () => {
                    if (VERBOSE) console.log(` *** portscanner<udp> // hit // ${host}[:${port}] ***`)
                    socket.close()
                    resolve(true);
                });
                socket.on('error', () => {
                    if (VERBOSE) console.log(` --- p___sc_____<udp> .. ___ .. ${host}[:${port}] ---`)
                    socket.close();
                    tcp();
                });

                socket.connect(port, host);
            }    

            function tcp() {
                const socket = new Socket();
                socket.setTimeout(15000)
                socket.on('connect', () => {
                    if (VERBOSE) console.log(` *** portscanner<tcp> // hit // ${host}[:${port}] ***`)
                    socket.destroy();
                    resolve(true);
                });
                socket.on('timeout', () => {
                    if (VERBOSE) console.log(` --- p___sc_____<tcp> .. ___ .. ${host}[:${port}] ---`)
                    socket.destroy();
                    resolve(false);
                });
                socket.on('error', () => {
                    if (VERBOSE) console.log(` --- p___sc_____<tcp> .. ___ .. ${host}[:${port}] ---`)
                    socket.destroy();
                    resolve(false);
                });
                socket.connect(port, host);
            }

            if ([143, 993, 995].includes(port)) {
                udp();
            } else {
                tcp();
            }
        });
    };

    export function webmail(dom, source){
        return new Promise(async resolve=>{
            if (typeof dom === "object" && dom instanceof Array) {
                for (let d of dom) {
                    let p = await webmail(d, source);
                    if (p) return resolve(p);
                }
                resolve();
            } else {
                let q = queueMaker();
                q.webmail(dom, source);                

                async.parallel(q.queue(), function(){
                    let servers = q.servers();
                    sortServers(servers,resolve);
                });
            }
        })
    }

    export function pop3(dom, source){
        return new Promise(async resolve=>{
            if (typeof dom === "object" && dom instanceof Array) {
                for (let d of dom) {
                    let p = await pop3(d, source);
                    if (p) return resolve(p);
                }
                resolve();
            } else {
                let q = queueMaker();
                q.pop3(dom, source);               

                async.parallel(q.queue(), function(){
                    let servers = q.servers();
                    sortServers(servers,resolve);
                });
            }
        })
    }

    export function imap(dom, source){
        return new Promise(async resolve=>{
            if (typeof dom === "object" && dom instanceof Array) {
                for (let d of dom) {
                    let p = await imap(d, source);
                    if (p) return resolve(p);
                }
                resolve();
            } else {
                let q = queueMaker();
                q.imap(dom, source);                

                async.parallel(q.queue(), function(){
                    let servers = q.servers();
                    sortServers(servers,resolve);
                });
            }
        })
    }

    export function portscan(dom, source){
        return new Promise(async resolve=>{
            if (typeof dom === "object" && dom instanceof Array) {
                for (let d of dom) {
                    let p = await imap(d, source);
                    if (!p) p = await webmail(d, source);
                    if (!p) p = await pop3(d, source);
                    if (p) return resolve(p);
                }
                resolve();
            } else {
                let q = queueMaker();
                q.imap(dom, source);
                q.pop3(dom, source);
                q.webmail(dom, source);                

                async.parallel(q.queue(), function(){
                    let servers = q.servers();
                    sortServers(servers,resolve);
                });
            }
        })
    }

    function queueMaker() {
        let queue = [];
        let servers = []

        function pusher(hostname, port, type, ssl, source) {
            queue.push(function(cb){
                (async()=>{
                    let result = await portscanner(hostname, port);
                    if (result) {
                        servers.push({ hostname, port, type, ssl, source })
                    }
                    cb();
                })()
            })
        }

        function imap(hostname, source) {
            pusher(hostname, 993, "imap", true, source)
            pusher(hostname, 143, "imap", false, source)
        }

        function pop3(hostname, source) {
            pusher(hostname, 995, "pop3", true, source)
            pusher(hostname, 110, "pop3", false, source)
        }

        function webmail(hostname, source) {
            pusher(hostname, 2096, "webmail", true, source)
            pusher(hostname, 2095, "webmail", false, source)
        }

        return {
            imap,
            pop3,
            webmail,
            queue() { return queue },
            servers() { return servers }
        }
    }

/*
    export function search(dom){
        return new Promise(async resolve=>{
            let q = queueMaker();

            let parts = dom.split(".")
            if (parts?.length < 2) return resolve()

            else {
                let tld_parts = (parts[parts.length-1].length === 2 && parts[parts.length-2].length === 2)?3:2;
                let sub_mail_tld = parts.length>tld_parts ? [...parts].splice(1,0,"mail").join("."): undefined;
                let no_sub_just_tld = parts.length>tld_parts ? [...parts].splice(0,1).join("."): undefined;
                
                let america_com = (tld_parts > 2) ? [...parts].join(".").replace(parts[parts.length-2]+"."+parts[parts.length-1],"com"): undefined;
                let america_net = (tld_parts > 2) ? [...parts].join(".").replace(parts[parts.length-2]+"."+parts[parts.length-1],"net"): undefined;
                
                function perdom(domain) {
                    q.imap(`imap.${domain}`);
                    q.imap(`mail.${domain}`);
                    q.imap(`imap4.${domain}`);
                    q.imap(`mx.${domain}`);
                    q.imap(domain);

                    q.pop3(`mail.${domain}`);
                    q.pop3(`pop.${domain}`);
                    q.pop3(`pop3.${domain}`);
                    q.pop3(`mx.${domain}`);
                    q.pop3(domain);

                    q.webmail(domain);
                    q.webmail("mail."+domain);
                    q.webmail("webmail."+domain);
                }

                perdom(dom);

                if (sub_mail_tld) {
                    q.imap(sub_mail_tld)
                    q.pop3(sub_mail_tld);
                    q.webmail(sub_mail_tld);
                }

                async.parallel(q.queue(), function(){
                    let servers = q.servers();
                    if (servers.length > 0) {
                        sortServers(servers,resolve)
                    } else if (no_sub_just_tld || (america_com && america_net)) {
                        q = queueMaker();
                        if (no_sub_just_tld) perdom(no_sub_just_tld)
                        if (america_com && america_net) {
                            perdom(america_com)
                            perdom(america_net)
                        }
                        async.parallel(q.queue(), function(){
                            let servers = q.servers();
                            sortServers(servers,resolve);
                        });
                    } else resolve();
                })
            }
        });
    }
*/
    export function sortServers(servers, resolve){
        if (servers.length > 1) {
            servers.sort(function(a,b){
                return a.port > b.port ? -1 : 1
            })
            servers.sort(function(a,b){
                if (a.type !== b.type) {
                    return a.type === "imap" ? -1 : a.type === "webmail" ? 1 : -1
                } else {
                    return 0;
                }
            })
        }

        if (servers.length > 0) {
            resolve(servers[0])
        } else {
            resolve()
        }
    }

    export default {
        imap,
        pop3,
        webmail,
        portscan,
        sortServers
   //     search
    }