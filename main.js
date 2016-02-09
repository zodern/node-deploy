#!/usr/bin/env node

var path      = require('path'),
    fs        = require('fs'),
    nodemiral = require('nodemiral'),
    async     = require('async'),
    home      = require('home'),
    child     = require('child_process');

var SCRIPT_DIR = __dirname + '/scripts/';
var cwd = path.resolve('.');

// check for deploy.json
var file = fs.readFileSync(path.resolve(cwd, 'deploy.json'));
var config = JSON.parse(file);

var DigitalOceanApi = require('digital-ocean-api');

var api = new DigitalOceanApi({
  token: config.token
});

var program = require('commander');

program.version('0.0.1');
program
  .command('scale [amount]')
  .description('Creates new droplets')
  .action(function (amount, options) {
    console.log('Creating', amount, 'new servers');
    scale(amount);
  });

program
  .command('list')
  .description('Lists droplets for app')
  .action(function () {
    listDroplets(function (err, result) {
      if(err) {
        return console.log(err);
      }
      console.log(JSON.stringify(result, null, 2));
    });
  });

program
  .command('deploy')
  .description('Deploy code in current directory to the servers')
  .action(function () {
    deploy();
  });

program
  .command('setup')
  .description('Sets up the servers')
  .action(function () {
    setup();
  });

program.parse(process.argv);


var dropletsList = [];

// get list of droplets
function listDroplets(cb) {
  api.listDroplets(function (err, droplets) {
    if(err) {
      return cb(err);
    }
    dropletsList = [];
    droplets.forEach(function (droplet) {
      if(droplet.name.indexOf(config.name) === 0) {
        dropletsList.push(droplet);
        console.log('droplets in app', dropletsList.length);
      }
    });
    cb(err, dropletsList);
  });
}


function scale(amount) {
  var created = 0;
  for (var i = 0; i < amount; i++) {
    var options = {
      name: config.name + '-' + new Date().getTime() + '-' + Math.random(),
      region: 'nyc1',
      ssh_keys: [config.sshKeyDO],
      size: '512mb',
      image: 'ubuntu-15-10-x64',
      backups: false,
      ipv6: false,
      private_networking: false
    };
    console.dir(options);
    api.createDroplet(options, function (e, r) {
      // console.log(e, r);
      created += 1;
      console.log('created ', created, '/', amount);

    });
  }

  // wait until all are active
  var interval = setInterval(function () {
    listDroplets(function (err, list) {
      var running = 0;
      var total = list.length;

      list.forEach(function (droplet) {
        if(droplet.status === 'active') {
          running += 1;
        }
      });
      console.log(running, '/', total, 'droplets are running');
      if(running == total) {
        clearInterval(interval);
        setup(function (e) {
          if(e) {
            return;
          }
          deploy();
        });

      }
    });
  }, 15000);

}

function createSessions(droplets, done) {
  var pem = fs.readFileSync(home.resolve('~/.ssh/' + config.sshKey), 'utf8');
  console.log('-- creating sessions --');
  droplets.forEach(function (droplet) {
    var nodemiralOptions = {
      username: 'root',
      pem: pem,
      keepAlive: true
    };
    var hostname = droplet.networks.v4[0].ip_address;
    //console.dir(droplet);
    droplet.session = nodemiral.session(hostname, nodemiralOptions);
  });
  done(null, droplets);
}

function testSession(droplets, done) {
  console.log('-- testing sessions --');
  async.forEach(droplets, function (droplet, done) {
    //console.log(droplet);
    droplet.session.execute('uname -a', function (err, code, logs) {
      console.log(err, code, logs.stdout);
      done(null);
    });
  }, function (e, r) {
    //console.log(e, r);

    done(e, droplets);
  });
}

function install(droplets, done) {
  console.log('-- installing deps --');
  async.forEachSeries(droplets, function (droplet, done) {
    console.log('-- starting deps install for a droplet --');
    droplet.session.executeScript(path.resolve(SCRIPT_DIR, 'install.sh'), function (e, code, log) {
      console.log(e);
      console.log(code);
      console.log(log.stdout);
      done(null);
    });
  }, function (e, r) {
    console.log('finished install');
    done(e, droplets);
  });
}

function userInstall(droplets, done) {
  if(!config.installScript) {
    console.log('-- no app install script --');
    done(null, droplets);
  }
  console.log('-- installing app install script --');
  var scriptPath = path.resolve(cwd, config.installScript);
  async.forEachSeries(droplets, function (droplet, done) {
    droplet.session.executeScript(scriptPath, function (err, code, log) {
      console.log('code', code);
      console.log(log.stderr);
      console.log(log.stdout);
      console.log('err', err);
      console.log('finished droplet');
      done(null);
    });
  }, function (e, r) {
    console.log('finished install');
    done(e, droplets);
  })
}

function setup(cb) {
  console.log('-- setting up --');
  async.waterfall([
    listDroplets,
    createSessions,
    testSession,
    install,
    userInstall
  ], function (err, res) {
    console.log(err);
    console.log('-- finished setting up droplets--');

    if(typeof cb === 'function') {
      cb(err);
    }

  });
}

function pack(options, done) {
  console.log('-- packing code --');
  child.exec('npm pack ' + cwd, {
    cwd: path.resolve(cwd, '.node-deploy')
  }, function (err, stdout, stderr) {
    console.log(err);
    console.log(stdout);
    options.bundle = path.resolve(cwd, '.node-deploy', stdout.trim());
    done(err, options);
  });
}

function getSessions(options, done) {
  console.log('-- getting list of servers --');
  listDroplets(function (err, droplets) {
    console.log('-- connecting to server --');
    createSessions(droplets, function (err, droplets) {
      options.droplets = droplets;
      done(err, options);
    });
  });
}

function upload(options, done) {
  console.log('-- uploading code --');
  async.forEachSeries(options.droplets, function (droplet, done) {
    console.log('starting upload for droplet');
    droplet.session.copy(options.bundle, '/tmp/bundle.tgz', {
      progressBar: true
    }, function (err, res) {
      if(err) {
        console.log('error uploading');
      }
      done(err, options);
    });
  }, function (e, res) {
    console.log(e, res);
    done(null, options);
  })
}

function startApp(options, done) {
  console.log('-- starting app --');
  async.forEach(options.droplets, function (droplet, done) {
    droplet.session.executeScript(path.join(SCRIPT_DIR, 'deploy.sh'), {
      vars: {
        ip: droplet.networks.v4[0].ip_address
      }
    }, function (err, code, log) {
      console.log('err', err);
      console.log('code', code);
      console.log(log.stdout);
      console.log(log.stderr);
      done(err);
    })
  }, function (err, result) {
    done(err);
  });
}

function deploy() {
  var folder = path.resolve(cwd, '.node-deploy');
  console.log(folder);
  try {
    fs.mkdirSync(folder);
  } catch (e) {
    if(e.code !== 'EEXIST') {
      console.log('error creating a folder');
      process.exit(1);
    }
  }

  async.waterfall([
    function initialData(done) {
      done(null, {
        folder: folder
      });

    },
    pack,
    getSessions,
    upload,
    startApp
  ], function (e, r) {
    if(e) {
      console.log('e');
    }
    console.log('-- finished --');
  });
}


