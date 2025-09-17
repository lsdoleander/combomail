
import datasource from './modules/@data.js'
import domainiac from 'domainiac'
import { series } from 'async'
import { komponent } from 'konsole'

import { Command } from 'commander'
import { writeFileSync } from 'fs'
import { resolve as pwd } from 'path'


const program = new Command();

program.name('combomail')
    .version("0.3.1");

program.command("country")
    .option("-d,--db <file>", "which database (default: whichever ui is currently using).")
    .action(async (x, options)=>{
        if (options.db) datasource.load(options.db)

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
					datasource.session.update({ user, country });
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
    })

program.command("export")
    .option("-d,--db <file>", "which database (default: whichever ui is currently using).")
    .option("-o,--output <file>", "name the output file.")
    .action(async (x, options)=>{
		try {   
	        if (options.db) datasource.load(options.db)

	        let f = pwd(options.output || "./export")+".qssess";
			let output = "";
			for (let s of datasource.session.select()){
				const { user, pass, country, module: m, session } = s;
				output += JSON.stringify({ user, pass, country, module: m, session })+"\n";
			}
			writeFileSync(f, output);
		} catch(ex) {
			console.log(ex);
		}
    })

program.parse() 