
import Database from 'better-sqlite3';
import datadir from '../ui/datadir.js';
import path from 'node:path';
import fs from 'node:fs';

import { v4 } from 'uuid';

export default (function(){

	let db = (function() {
		let dir = datadir("combomail");
		let datafile = path.join(dir, "sessions.db");
		let create = !fs.existsSync(datafile);

		let data = new Database(datafile);
		data.pragma('journal_mode = WAL');

		if (create) {
			data.exec("CREATE TABLE sessions (user TEXT, pass TEXT, data TEXT, session TEXT, json INTEGER)");
			data.exec("CREATE TABLE search (id TEXT, timestamp INTEGER, term TEXT, hits TEXT, pending TEXT, complete INTEGER)");
			data.exec("CREATE TABLE combo (id TEXT, timestamp INTEGER, pending TEXT, complete INTEGER)");
		}
		
		return data;
	})();
	
	return {
		session: (function(){

			function create({ user, pass, session }){
				del(user)

				const stmt2 = db.prepare("INSERT INTO sessions (user, pass, session, json) VALUES (@user, @pass, @session, @json)");
				stmt2.run({
					json: (typeof session === "object") ? 1 : 0,
					session: (typeof session === "object") ? JSON.stringify(session) : session,
					user: user,
					pass: pass
				});
			}

			function importer( lines ){
				const stmt2 = db.prepare("INSERT INTO sessions (user, pass, session, json) VALUES (@user, @pass, @session, @json)");
				for (let s of lines) {
					try {
						let o = JSON.parse(s);
						stmt2.run({
							json: (typeof o.session === 'object') ? 1 : 0,
							session: (typeof o.session === 'object') ? JSON.stringify(o.session) : o.session,
							user: o.user,
							pass: o.pass
						});
					} catch(e) {
						// Line Didn't Parse
					}
				}
			}
					
			function update({ user, session, data }){
				const stmt2 = db.prepare(`UPDATE sessions SET ${session?'session=@session':''} ${data?'data=@data':''} WHERE user=@user`);
				stmt2.run({
					session: (typeof session === "object") ? JSON.stringify(session) : session,
					data: data ? JSON.stringify(data) : null,
					user: user
				});
			}

			function load(){
				const stmt = db.prepare("SELECT * from sessions");
				let sessions = stmt.all();
				let combo = [];
				let map = {};
				let userdata = {};
				for (let s of sessions) {
					map[s.user] = (s.json === 0) ? s.session : JSON.parse(s.session);
					if (s.data !== null) userdata[s.user] = JSON.parse(s.data);
					combo.push(`${s.user}:${s.pass}`)
				}
				return { map, combo, userdata };
			}

			function del({ user, pass }){
				const stmt = db.prepare("DELETE FROM sessions WHERE user = @user");
				stmt.run({ user });
			}

			return { create, update, load, import: importer, delete: del };
		})(),

		combo: {
			create(pending) {
				const stmt = db.prepare("INSERT INTO combo (id, timestamp, pending, complete) VALUES (@id, @timestamp, @pending, 0)");
				let id = v4();
				stmt.run({
					id,
					timestamp: new Date().getTime(),
					pending: JSON.stringify(pending)
				})
				return id;
			},

			update(id,pending) {
				const stmt = db.prepare("UPDATE combo SET pending=@pending, complete=@complete WHERE id=@id");
				stmt.run({
					id,
					pending: JSON.stringify(pending),
					complete: pending.length > 0 ? 0 : 1
				})
			},

			delete(id) {
				const stmt = db.prepare("DELETE FROM combo WHERE id=@id");
				stmt.run({ id })
			},

			load(id) {
				const stmt = db.prepare("SELECT pending FROM combo WHERE id=@id")
				return stmt.get({ id });
			},

			incomplete(){
				const stmt = db.prepare("SELECT id, pending FROM combo WHERE complete=0")
				return stmt.get();
			}
		},

		search: {
			create(term, hits, pending) {
				const stmt = db.prepare("INSERT INTO search (id, timestamp, term, hits, pending, complete) VALUES (@id, @timestamp, @term, @hits, @pending, 0)");
				let id = v4();
				stmt.run({
					id,
					timestamp: new Date().getTime(),
					term,
					hits: JSON.stringify(hits),
					pending: JSON.stringify(pending)
				})
				return id;
			},

			update(id, hits, pending) {
				const stmt = db.prepare("UPDATE search SET hits=@hits, pending=@pending, complete=@complete WHERE id=@id");
				stmt.run({
					id,
					hits: JSON.stringify(hits),
					pending: JSON.stringify(pending),
					complete: pending.length > 0 ? 0 : 1
				})
			},

			delete(id) {
				const stmt = db.prepare("DELETE FROM search WHERE id=@id");
				stmt.run({ id })
			},

			load(id) {
				const stmt = db.prepare("SELECT term, hits, pending FROM search WHERE id=@id")
				return stmt.get({ id });
			},

			incomplete(){
				const stmt = db.prepare("SELECT id, term, hits, pending FROM search WHERE complete=0")
				return stmt.get();
			}
		}
	}
	
})()