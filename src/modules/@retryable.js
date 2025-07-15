
	export default function retryable(resolve,_function, opts={ max:10, delay:5000, logsto:console }) {
		return new Promise(async success=>{
			(function exe(tries){
				let newproxy;

				function retry(x) {
					if (tries < opts.max) {
						if (opts.nextproxy) newproxy = opts.nextproxy();
						setTimeout(()=>{ exe(tries+1) }, opts.delay);
					} else {
						opts.logsto.log(x);
						resolve({ success: false, error: "tries exceeded" })
					}
				}

				try {
					_function({ retry, success, newproxy, fail: function(e){
						if (!e) {
							resolve({ success: false })
						} else {
							opts.logsto.log(e);
							resolve({ success: false, error: e })
						}
					}})
				} catch(x) {
					retry(x)
				}
			})(0);
		})
	}