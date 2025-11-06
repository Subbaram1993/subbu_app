#!/bin/bash
# Start Ngrok to expose 192.168.241.134:3000
/usr/local/bin/ngrok http 192.168.241.134:3000 --host-header=192.168.241.134 &

# Wait for Ngrok to start (increase sleep time to 20 seconds)
sleep 20

# Check if Ngrok is running by fetching the public URL
if pgrep -x "ngrok" > /dev/null; then
  # Fetch the public URL from the Ngrok API and extract only the forwarding URL
  public_url=$(curl --silent http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url' | grep -o 'https://[^"]*')

  if [[ -n "$public_url" ]]; then
    # Print only the forwarding URL
    echo "$public_url"
  else
    echo "Error: Unable to fetch the public URL."
  fi
else
  echo "Error: Ngrok is not running."
fi
