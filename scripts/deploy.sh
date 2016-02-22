#!bin/bash

APP_DIR=/app
UNTAR=/tmp/node-deploy-app/
APP_TMP=/tmp/node-deploy-app/package/
BUNDLE=/tmp/bundle.tgz


cd /tmp

sudo rm -rf $UNTAR

sudo mkdir $UNTAR

sudo tar -zxvf $BUNDLE -C $UNTAR > /dev/null
cd $APP_TMP
echo $PWD
ls
npm install

sudo rm -rf $APP_DIR

sudo mkdir $APP_DIR

sudo mv $APP_TMP $APP_DIR

cd ${APP_DIR}/package

read -d '' SETTINGS <<"EOF"
  {
    "apps": [
      {
       "name": "app",
        "script": "/bin/bash",
          "args": [
            "-c",
            "-o",
            "pipefail",
            "cd /app/package && /usr/bin/npm start"
          ],
       "log_date_format": "YYYY-MM-DD",
       "env": {
         "ip": "<%= ip %>",
         "NODE_ENV": "production",
         "PORT": 80
        }
      }
    ]
  }
EOF

cd ..
echo $SETTINGS > app.json


pm2 stop app > /dev/null
pm2 delete app > /dev/null
pm2 start app.json
pm2 startup > /dev/null
