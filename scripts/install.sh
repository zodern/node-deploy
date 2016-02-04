#!/bin/bash

# Needed to install python
#sudo add-apt-repository ppa:fkrull/deadsnakes -y

sudo apt-get update -y

# Install node

NODE_VERSION=0.12.0
NODE_ARCH=x64

sudo apt-get -y install build-essential libssl-dev git curl

NODE_DIST=node-v${NODE_VERSION}-linux-${NODE_ARCH}

cd /tmp
wget http://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIST}.tar.gz
tar xvzf ${NODE_DIST}.tar.gz
sudo rm -rf /opt/nodejs
sudo mv ${NODE_DIST} /opt/nodejs

sudo ln -sf /opt/nodejs/bin/node /usr/bin/node
sudo ln -sf /opt/nodejs/bin/npm /usr/bin/npm

sudo npm install -g pm2

# Install PhantomJS
 sudo apt-get -y install libfreetype6 libfreetype6-dev fontconfig > /dev/null
 ARCH=`uname -m`
 PHANTOMJS_VERSION=1.9.8

 cd /usr/local/share/
 sudo wget https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-${PHANTOMJS_VERSION}-linux-${ARCH}.tar.bz2 > /dev/null
 sudo tar xjf phantomjs-${PHANTOMJS_VERSION}-linux-${ARCH}.tar.bz2  > /dev/null
 sudo ln -s -f /usr/local/share/phantomjs-${PHANTOMJS_VERSION}-linux-${ARCH}/bin/phantomjs /usr/local/share/phantomjs
 sudo ln -s -f /usr/local/share/phantomjs-${PHANTOMJS_VERSION}-linux-${ARCH}/bin/phantomjs /usr/local/bin/phantomjs
 sudo ln -s -f /usr/local/share/phantomjs-${PHANTOMJS_VERSION}-linux-${ARCH}/bin/phantomjs /usr/bin/phantomjs

# Install python
sudo apt-get -y install python
#npm config set python /usr/bin/python2.7 -g |

# create swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
