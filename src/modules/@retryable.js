
	export default function retryable(resolve,_function, opts={ max:10, delay:5000, logsto:console }) {
		return new Promise(async success=>{
			(function exe(tries){
				function retry(x) {
					if (tries < opts.max) {
						setTimeout(()=>{ exe(tries+1) }, opts.delay);
					} else {
						resolve({ success: false, error: "tries exceeded", x })
					}
				}

				try {
					_function({ retry, success, fail: function(e){
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