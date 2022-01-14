#!/bin/bash
echo "" > build_log.txt

if dpkg -s build-essential &>/dev/null
	then 
		printf "Build-essential package is installed. Nice.\n"
	else
		printf "Build-essential package missing. Installing...\n"
		apt-get install -y build-essential &>/dev/null
		if dpkg -s build-essential &>/dev/null
		then 
		printf " OK\n"
		else
		printf "Build-essential package still missing ! Error, this installation will stop now.\n"
		exit 1
		fi
fi 

echo "installing basic volumio plugin dependencies"
npm install kew  >> build_log.txt
npm install v-conf  >> build_log.txt

echo "Installing nodejs dependencies:"
printf "\trpio (hardware interface with display)..."
npm install rpio  >> build_log.txt
printf " OK\n"
printf "\tdate-and-time (helper for printing dates on display)..."
npm install date-and-time >> build_log.txt
printf " OK\n"

# Very nasty way of getting the current socket.io-client version used in Volumio core
# (nested template piped to node in subshell but whatever works)
socket_client_version=$(echo "console.log(`cat /volumio/node_modules/socket.io-client/package.json`.version)" | node)

printf "\tsocket.io-client@${socket_client_version}  (communication with Volumio player)..."
npm install socket.io-client@${socket_client_version} >> build_log.txt
printf " OK\n"



exit 0