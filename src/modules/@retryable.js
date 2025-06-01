
	export default function retryable(resolve,_function, max=10, delay=5000) {
		return new Promise(async success=>{
			(function exe(tries){
				function retry(x) {
					if (tries < max) {
						setTimeout(()=>{ exe(tries+1) }, delay);
					} else {
						resolve({ success: false, error: "tries exceeded", x })
					}
				}

				try {
					_function({ retry, success, fail: function(e){
						if (!e) {
							resolve({ success: false })
						} else {
							resolve({ success: false, error: e })
						}
					}})
				} catch(x) {
					retry(x)
				}
			})(0);
		})
	}