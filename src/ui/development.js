
import express from 'express';

export default function (app, urlpath, folder) {
	app.use(express.static(folder, urlpath))
}