#!/bin/bash

# Needed to install python
#sudo add-apt-repository ppa:fkrull/deadsnakes -y

sudo apt-get update -y

# Install node

NODE_VERSION=0.12.0
NODE_ARCH=x64

sudo apt-get -y install build-essential libssl-dev git curl authbind
sudo touch /etc/authbind/byport/80
sudo chown %user% /etc/authbind/byport/80
sudo chmod 755 /etc/authbind/byport/80
authbind --deep pm2 update
echo  'alias pm2=\'authbind --deep pm2\'' >> ~/.bashrc

NODE_DIST=node-v${NODE_VERSION}-linux-${NODE_ARCH}

cd /tmp
wget http://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIST}.tar.gz
tar xvzf ${NODE_DIST}.tar.gz
sudo rm -rf /opt/nodejs
sudo mv ${NODE_DIST} /opt/nodejs

sudo ln -sf /opt/nodejs/bin/node /usr/bin/node
sudo ln -sf /opt/nodejs/bin/npm /usr/bin/npm

sudo npm install -g pm2
sudo npm install -gf git+https://git@github.com/zodern/Silk.git

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
