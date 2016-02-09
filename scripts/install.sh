#!/bin/bash

# Needed to install python
#sudo add-apt-repository ppa:fkrull/deadsnakes -y

sudo apt-get update -y

# Install node
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.30.2/install.sh | bash
nvm install 0.12.0
nvm use 0.12.0

sudo npm install -g pm2

# Install PhantomJS
 sudo apt-get -y install libfreetype6 libfreetype6-dev fontconfig > /dev/null

# Install python
sudo apt-get -y install python
#npm config set python /usr/bin/python2.7 -g |

# create swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
