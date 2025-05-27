

import path from 'node:path';
import fs from "node:fs";

export default function (name) {
	let dir;
	if (process.platform === 'linux') {
		dir = path.join(process.env.HOME, "/.local/share/", name);
	} else if (process.env.APPDATA) {
		dir = path.join(process.env.APPDATA, name); 
	} else if (process.platform == 'darwin') {
		dir = path.join(process.env.HOME, '/Library/Preferences', name);
	} else {
		dir = path.join(process.env.HOME, `.${name}`);
	}

	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir, { recursive: true });
	}

	return dir;
}