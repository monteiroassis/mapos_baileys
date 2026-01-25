#!/bin/bash
# start_whatsapp.sh

# Add common paths to ensure node is found
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin

# Define paths and navigate to directory first
cd "$(dirname "$0")"
API_DIR=$(pwd)
LOG_FILE="$API_DIR/whatsapp_debug.log"

echo "DEBUG: Script executed from: $0" > "$LOG_FILE"
echo "DEBUG: API_DIR: $API_DIR" >> "$LOG_FILE"
echo "DEBUG: LOG_FILE: $LOG_FILE" >> "$LOG_FILE"

# Already in directory


# Check if node is installed/in path
if ! command -v node &> /dev/null; then
    echo "Node.js not found in PATH" > "$LOG_FILE"
    echo "Current PATH: $PATH" >> "$LOG_FILE"
    exit 1
fi

# Kill existing process if running (safety check)
# lsof -t -i :3000 | xargs kill -9 2>/dev/null

# Start Node.js service completely detached
# nohup effectively ignores SIGHUP
# > log redirects stdout
# 2>&1 redirects stderr to stdout
# < /dev/null closes stdin so it doesn't wait for input
# & puts it in background
nohup node server.js >> "$LOG_FILE" 2>&1 < /dev/null &

# Print PID to stdout so calling process can grab it
echo $!
