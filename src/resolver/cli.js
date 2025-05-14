
	import index from './index.js'

	index(process.argv[2], "info@" + process.argv[2]).then(server=>{
		console.log(server?server:"Not Found.")
	})