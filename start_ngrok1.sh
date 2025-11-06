#!/bin/bash
# Start Ngrok and capture output in a variable
ngrok_output=$(ngrok http 3000)

# Print only the forwarding URL
echo "$ngrok_output" | grep -i "forwarding" | awk '{print $2}'
