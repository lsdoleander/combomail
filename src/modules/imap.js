	
import { ImapFlow } from 'imapflow'
import PostalMime from 'postal-mime';
import util from 'node:util';


export default function (sessions) {
	return function imap(host, port) {
		return function login(user, pass) {

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

			function search(terms) {		
				return new Promise(async resolve=>{
					try {
						let mailbox = await client.mailboxOpen('INBOX');

						let words = terms.trim().split(" ");
						let ors = [];
						for (let word of words) {
							ors.push({ from: word });
							if (!/.*@.*/.test(word)) ors.push({ subject: word })
						}

						let list = await client.search({ or: ors }, { uid: true });
						resolve(fetcher(list));
						
					} catch (ex) {
						resolve({ error: ex.message })
					}
				})
			}

			function fetcher(id) {	
				return new Promise(async resolve=>{
					
					let out = {
						total: id.length,
						userdata: {
							email: user
						},
						results: [],
						user
					};

					let list = id.length > 25 ? id.splice(id.length - 25) : id;

					const lock = await client.getMailboxLock('INBOX');
					
				  	try {
					    for await (const m of client.fetch(id, {
					      envelope: true,
					      bodyParts: true,
					      bodyStructure: true,
					      headers: true
					    })) {

							let headers = m.headers.toString("utf-8");// Node.js
							const email = await PostalMime.parse(headers);
					      	let from = email.from.match(/([^<]+)\s?<([^>]+)>/);
							let r = {
								ui: email.uid,
								from: {
									address: from ? from[2] : email.from,
								},
								subject: email.subject,
								date: new Date(email.date).getTime()
							};
							if (from) r.from.name = from[1];
							out.results.push(r);
				    	}

					} catch (ex) {
						console.log(ex)

					} finally {
					    lock.release();
					    client.close();
					    resolve(out);
					}
				})
			}

			function body(id) {
				return new Promise(async resolve=>{
					const {content} = await client.download(m.uid, ['TEXT']);
					resolve({ html: content });
				})
			}

			return new Promise(async resolve=>{
				try {
					await client.connect();
					sessions.create({ user, pass, session: "imap" });
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