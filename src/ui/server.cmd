@echo off

START /B node "src\ui\server.js" > "ui.log"

edge "http://localhost:8675/"
more "ui.log"