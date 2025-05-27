@echo off

START /B node "src\ui\server.js" > "ui.log" 2>&1
START /B edge "http://localhost:8675/" > NUL 2>&1
more "ui.log"