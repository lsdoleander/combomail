
import datasource from './modules/@data.js'

let s = datasource.search.incomplete();
if (s) {
	datasource.search.delete(s.id);
}

let c = datasource.combo.incomplete();
if (c) {
	datasource.combo.delete(c.id);
}