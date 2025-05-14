	
	import { ImapFlow } from 'imapflow'
	import PostalMime from 'postal-mime';
	import util from 'node:util';


	export default function imap(host, port) {
		
		return function(user, pass) {

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
					
					let out = [];
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
					      	const {content} = await client.download(m.uid, ['TEXT']);
							out.push({
								uid: email.uid,
								from: email.from,
								to: email.to,
								subject: email.subject,
								date: new Date(email.date).getTime(),
								body: content
							})
				    	}

					} catch (ex) {
						console.log(ex)

					} finally {
					    lock.release();
					    resolve(out);
					}
				})
			}

			return new Promise(async resolve=>{
				try {
					await client.connect();

					resolve({
						search,
						fetcher,
						close: client.close
					})

				} catch (ex) {
					resolve({ error: ex.message })
				}
			})
		}
	}