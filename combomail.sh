#!/bin/bash

node src/ui/server.js &> ui.log &
chromium http://localhost:8675/ &> /dev/null &
tail +0f ui.log