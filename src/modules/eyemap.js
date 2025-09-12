import Imap from 'imap';
import { debuffer, datadir } from 'konsole';
import { simpleParser } from 'mailparser';

let debug = debuffer(datadir.share("combomail","logs")).logger("imap");

export default function (sessions) {
    return {
        imap(host, port) {
            return {
                queue: "main",
                name: "imap",
                login(user,pass,domain,country) {
                    let imap;
                    let error_handler;

                    function SearchObject(terms, attachments) {
                        let words = terms.trim().split(" ");
                        let subject = [], from = [];
                        for (let word of words) {
                            if (/.*@.*/.test(word)) {
                                from.push(word);
                            } else {
                                subject.push(word);
                            }
                        }

                        let search = [];
                        if (from.length === 1) {
                            search.push([ 'FROM', from[0] ]);
                        } else if (from.length > 1) {
                            let ors = [ 'OR' ];
                            for (let sender of from) {
                                ors.push([ 'FROM', sender ]);
                            }
                            search.push(ors);
                        }
                        if (subject.length > 0) {
                            let text = subject.join(" ");
                            search.push([ 'OR', ['SUBJECT', text], ['BODY', text] ]);
                        }
                        if (attachments) {
                            search.push([ 'HEADER', 'Content-Disposition', 'attachment' ]);
                        }
                        return search;
                    }

                    function search(terms, attachments) {
                        return new Promise(resolve=>{
                            error_handler = ex=>{
                                imap.end();
                                debug.debug(ex);
                                resolve({ error: ex.message })
                            };

                            let searchresults = {
                                total: 0,
                                userdata: {
                                    email: user
                                },
                                results: [],
                                user
                            };

                            imap.openBox('INBOX', true, () => {
                                const sq = SearchObject(terms);
                                
                                imap.search(sq, (err, results) => {
                                    if (err) {
                                        imap.end();
                                        return resolve({ error: (typeof err === 'object') ? err.message : err });
                                    }

                                    searchresults.total = results?.length;

                                    if (!results || results.length === 0) {
                                        imap.end();
                                        return resolve(searchresults);
                                    }

                                    let list = results.length > 25 ? results.splice(results.length - 25) : results;

                                    let names = { map: {}, top: null, count: 0 };
                                    const f = imap.fetch(list, {bodies: ['HEADER.FIELDS (TO FROM SUBJECT)']});
                                    f.on('message', msg => {

                                        let m = {};
                                        msg.on('body', stream => {
                                            var buffer = '';
                                            stream.on('data', function(chunk) {
                                                buffer += chunk.toString('utf8');
                                            });
                                            stream.once('end', function() {
                                                let parsed = Imap.parseHeader(buffer);
                                                m = { ...m, ...parsed };
                                            });
                                        });
                                        msg.once('attributes', attrs => {
                                            m = { 
                                                id: attrs.uid,
                                                date: new Date(attrs.date).getTime(),
                                                read: attrs.flags.includes("\\Seen"),
                                                ...m
                                            };
                                        });
                                        msg.once('end', () => {
                                            let parts = m.from[0].match(/([^<]+)\s?<([^>]+)>/);
                                            if (parts) {
                                                m.from = {
                                                    name: parts[1],
                                                    address: parts[2]
                                                }
                                            } else {
                                                m.from = { address: m.from }
                                            }

                                            if (m.to) {
                                                parts = m.to[0].match(/([^<]+)\s?<([^>]+)>/);
                                                if (parts) {
                                                    let name = parts[1];
                                                    if (!names.map[name.toLowerCase()]) {
                                                        names.map[name.toLowerCase()] = 1;
                                                    } else {
                                                        names.map[name.toLowerCase()]++;
                                                    }

                                                    if (names.map[name.toLowerCase()] > names.count) {
                                                        names.count = names.map[name.toLowerCase()];
                                                        names.top = name;
                                                    }
                                                }
                                            }
                                            searchresults.results.splice(0,0,m);
                                        })
                                    });

                                    f.once('error', err => {
                                        debug.debug(err);
                                        imap.end();
                                        return resolve({ error: (typeof err === 'object') ? err.message : err });
                                    });

                                    f.once('end', () => {
                                        imap.end();

                                        let data = {
                                            country
                                        }
                                        if (names.count > 0) {
                                            data.name = names.top
                                        }

                                        sessions.update({ user, data });
                                        resolve(searchresults);
                                    });
                                });
                            });
                        })
                    }

                    function del(uid) {
                        return new Promise(resolve=>{
                            imap.addFlags(uid, ['SEEN', 'DELETED'], err=>{
                                imap.end();
                                
                                let out = {
                                    success: (!err)
                                }
                                if (err) out.error = err?.message || err
                                
                                resolve(out);
                            })
                        })
                    }

                    function body(uid) {
                        return new Promise(resolve=>{
                            error_handler = ex=>{
                                imap.end();
                                debug.debug(ex);
                                resolve({ error: ex.message })
                            };

                            imap.openBox('INBOX', true, () => {
                                const f = imap.fetch([uid], { bodies: '' })

                                f.on('message', msg => {
                                    msg.on('body', async function(stream, info) {
                                        let email = await simpleParser(stream, { skipHtmlToText: true });
                                        imap.end();
                                        resolve({ html: email.html || email.textAsHtml })
                                    })
                                });

                                f.once('error', err => {
                                    imap.end();
                                    debug.debug(err);
                                    return resolve({ error: (typeof err === 'object') ? err.message : err });
                                });
                            });
                        });
                    }

                    return new Promise(resolve=>{
                        const imapConfig = {
                            user,
                            password: pass,
                            host,
                            port,
                            tls: port > 900
                        };

                        imap = new Imap(imapConfig);
                        imap.once('ready', () => {
                            if (!sessions[user]) sessions.create({ user, pass, module: "imap", country, session: { type: "imap" }});
                            debug.log("session created:", user);

                            resolve({
                                success: true,
                                search,
                                delete: del,
                                body
                            })
                        });

                        error_handler = ex=>{
                            debug.debug(ex);
                            resolve({ error: ex.message })
                        };

                        imap.once("error", error_handler);
                        imap.connect();
                    })
                }
            }
        },
        EXCLUDE: [
            "21cn.com",
            "189.cn"
        ]
    }
}