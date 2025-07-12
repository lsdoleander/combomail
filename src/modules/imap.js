	
import { ImapFlow } from 'imapflow'
import PostalMime from 'postal-mime';
import util from 'node:util';

import { debuffer, datadir } from 'konsole';

let debug = debuffer(datadir.share("combomail","logs")).logger("imap");

export default function (sessions) {
	return function imap(host, port) {
		return {
			name: "imap",
			queue: "main",
			login(user, pass) {
				const client = new ImapFlow({
				    host,
				    port,
				    secure: port > 900,
				    auth: {
				        user,
				        pass
				    },
				    logger: false
				});

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

					let search = {};
					if (from.length === 1) {
						search.from = from;
					} else if (from.length > 1) {
						let ors = [];
						for (let sender of from) {
							ors.push({ from: sender });
						}
						search.or = ors;
					}
					if (subject.length > 0) {
						search.subject = subject.join(" ");
					}
					return search;
				}

/*				function search(terms) {		
					return new Promise(async resolve=>{
						try {
							let mailbox = await client.mailboxOpen('INBOX');
							
							

							let list = await client.search(search, { uid: true });

							resolve(fetcher(list));
							
						} catch (ex) {
							resolve({ error: ex.message })
						}
					})
				}*/

				function fetcher(id) {	
					return new Promise(async resolve=>{
						
						let out = {
							total: id?.length,
							userdata: {
								email: user
							},
							results: [],
							user
						};

						if (id?.length > 0) {
							let list = id.length > 25 ? id.splice(id.length - 25) : id;

							const lock = await client.getMailboxLock('INBOX');
							
						  	try {
							    for await (const m of client.fetch(id.join(","), {
								      headers: true,
								      uid: true
								    }, { 
								    	uid: true 
								    })) {

									let headers = m.headers.toString("utf-8");
									const email = await PostalMime.parse(headers);

									let r = {
										ui: email.uid,
										from: email.from,
										subject: email.subject,
										date: email.date ? new Date(email.date).getTime() : null
									};
									out.results.push(r);
						    	}

							} catch (ex) {
								debug.log(id, ex)

							} finally {
							    lock.release();
							    client.close();
							    resolve(out);
							}
						} else {
						    resolve(out);
						}
					})
				}

				function search(terms) {	
					return new Promise(async resolve=>{
						
						let out = {
							userdata: {
								email: user
							},
							results: [],
							user
						};

						const lock = await client.getMailboxLock('INBOX');
						const FetchQueryObject = {
							headers: true,
							uid: true
					    };

					  	try {
						    let list = await client.fetch(SearchObject(terms), FetchQueryObject);
						    out.total = list ? list.length : 0;
						    for (let idx = out.total; idx > (out.total > 25 ? out.total - 25 : 1); idx--) {
						    	let m = list[idx-1];
								let headers = m.headers.toString("utf-8");
								const email = await PostalMime.parse(headers);

								let r = {
									id: email.uid,
									from: email.from,
									subject: email.subject,
									date: email.date ? new Date(email.date).getTime() : null
								};
								out.results.push(r);
					    	}

						} catch (ex) {
							debug.log(id, ex)

						} finally {
						    lock.release();
						    client.close();
						    resolve(out);
						}
					})
				}

				function body(id) {
					return new Promise(async resolve=>{
						const {content} = await client.download(id, ['TEXT'], { uid: true });
						resolve({ html: content });
					})
				}

				return new Promise(async resolve=>{
					try {
						await client.connect();
						sessions.create({ user, pass, session: { type: "imap" }});
						resolve({
							success: true,
							search,
							body
						})

					} catch (ex) {
						if (sessions[user]) sessions.delete({ user, pass })
						resolve({ error: ex.message })
					}
				})
			}
		}
	}
}