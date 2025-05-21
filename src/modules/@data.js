
import Database from 'better-sqlite3';
import datadir from '../ui/datadir.js';
import path from 'node:path';
import fs from 'node:fs';

export default (function(){
	

		let db = (function() {
			let dir = datadir("combomail");
			let datafile = path.join(dir, "sessions.db");
			let create = !fs.existsSync(datafile);

			let data = new Database();
			data.pragma('journal_mode = WAL');

			if (create) {
				data.exec("CREATE TABLE sessions (user TEXT, pass TEXY, value TEXT, json INTEGER)");
			}
			
			return data;
		})();
		
		return {
			saveSession(user, session){
				const stmt = db.prepare("INSERT INTO sessions (user, pass, value, json) VALUES (@user, @pass, @value, @json)");
				stmt.run({
					json: (typeof session === "object") ? 1 : 0,
					value: (typeof session === "object") ? JSON.stringify(session) : session,
					user: user
				});
			},
			
			loadSessions(){
				const stmt = db.prepare("SELECT * from sessions");
				let sessions = stmt.all();
				let map = {};
				for (let s of sessions) {
					map[s.user] = (s.json === 0) ? s.value : JSON.parse(s.value);
				}
				return map;
			}
		}
	
})()