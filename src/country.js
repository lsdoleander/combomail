
import datasource from './modules/@data.js'
import domainiac from 'domainiac'
import { series } from 'async'
import { komponent } from 'konsole'

try {
	const konsole = komponent("combomail", "cyan").komponent("country", "red");
	konsole.log("Database migration: country populator");

	let stats = {
		total: 0,
		done: 0
	}

	function task(user) {
		return function(cb) {
			let domain = user.split("@")[1];
			let country = domainiac.country(domain);
			datasource.sessions.update({ user, country });
			stats.done++;
			setTimeout(cb,2);
		}
	}

	const list = datasource.session.nocountry();
	stats.total = list.length;

	let intv = setInterval(function(){
		konsole.replace(`${stats.total} / ${stats.done} : ${(stats.done/stats.total*100).toFixed(2)}%`);
	},200)

	let queue = [];
	for (const user of list) {
		queue.push(task(user.user));
	}

	series(queue, function(){
		clearInterval(intv);
		konsole.log("All Done.")
	})
} catch(ex) {
	console.log(ex);
}