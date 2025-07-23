import Imap from 'imap';
import { debuffer, datadir } from 'konsole';
import { simpleParser } from 'mailparser';

let debug = debuffer(datadir.share("combomail","logs")).logger("imap");

export default function (sessions) {
    return function imap(host, port) {
        return {
            queue: "main",
            name: "imap",
            login(user,pass) {
                let imap;
                let error_handler;

                function SearchObject(terms) {
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
                    return search;
                }

                function search(terms) {
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
                            debug.debug("search: ", sq);
                            
                            imap.search(sq, (err, results) => {
                                if (err) {
                                    imap.end();
                                    return resolve({ error: (typeof err === 'object') ? err.message : err });
                                }

                                searchresults.total = results?.length;
                                debug.debug("search results:", searchresults.total);

                                if (!results || results.length === 0) {
                                    imap.end();
                                    return resolve(searchresults);
                                }

                                let list = results.length > 25 ? results.splice(results.length - 25) : results;
                                debug.debug("fetch:", list);

                                const f = imap.fetch(list, {bodies: ['HEADER.FIELDS (FROM SUBJECT)']});
                                f.on('message', msg => {

                                    let m = {};
                                    msg.on('body', stream => {
                                        var buffer = '';
                                        stream.on('data', function(chunk) {
                                            buffer += chunk.toString('utf8');
                                        });
                                        stream.once('end', function() {
                                            let parsed = Imap.parseHeader(buffer);
                                            debug.debug(parsed);
                                            m = { ...m, ...parsed };
                                        });
                                    });
                                    msg.once('attributes', attrs => {
                                        debug.debug(attrs);
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
                                        searchresults.results.push(m);
                                    })
                                });

                                f.once('error', err => {
                                    debug.debug(err);
                                    imap.end();
                                    return resolve({ error: (typeof err === 'object') ? err.message : err });
                                });

                                f.once('end', () => {
                                    debug.debug('once(end)');
                                    debug.debug(searchresults);
                                    imap.end();
                                    resolve(searchresults);
                                });
                            });
                        });
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
                    debug.debug(imapConfig);

                    imap = new Imap(imapConfig);
                    imap.once('ready', () => {
                        debug.debug("ready("+user+")");
                        sessions.create({ user, pass, module: "imap", session: { type: "imap" }});
                        debug.log("session created:", user);

                        resolve({
                            success: true,
                            search,
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
    }
}