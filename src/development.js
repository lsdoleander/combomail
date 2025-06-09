
import express from 'express';

export default function (app, folder, urlpath) {
	app.use(express.static(folder, urlpath))
}

