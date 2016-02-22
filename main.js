#!/usr/bin/env node

var path      = require('path'),
    fs        = require('fs'),
    nodemiral = require('nodemiral'),
    async     = require('async'),
    home      = require('home'),
    child     = require('child_process'),
    select    = require('select-shell');

var dropletCommands = require('./lib/commands/droplets.js'),
    config          = require('./lib/config.js');

var SCRIPT_DIR = __dirname + '/scripts/';
var cwd = path.resolve('.');


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
    dropletCommands.list(true, function (err, result) {
      if(err) {
        return console.log(err);
      }
      result.forEach(function (droplet) {
        console.log(droplet.name + ' ( ' + droplet.networks.v4[0].ip_address + ' )');
      });
      process.exit(0);
      // console.log(JSON.stringify(result, null, 2));
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

program
  .command('logs')
  .description('Shows log for selected server')
  .action(logs);

program
  .command('silk')
  .description('Opens silk for a server')
  .action(silk);

program
  .command('restart')
  .description('Restarts the app')
  .action(restart);

program
  .command('run <command>')
  .description('Run a command')
  .action(function (command) {
    async.waterfall([
      function (done) {
        done(null, {});
      },
      getSessions,
      selectDroplet,
      function (options, next) {
        var droplet = options.droplet;
        console.log('--- running' + command + ' ---');
        droplet.session.execute('TERM=linux top', {
          onStdout: function (data) {
            process.stdout.write(data.toString());
          },
          onStderr: function (data) {
            process.stderr.write(data.toString());
          }
        }, function () {
          next(null, options);
        });
      }
    ], function (e) {
      if(e) {
        console.log(e);
      }
      console.log("--- finished running command ---");
    })
  });

program.parse(process.argv);

if(process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}


var dropletsList = [];

// get list of droplets
function listDroplets(cb) {
  api.listDroplets(function (err, droplets) {
    if(err) {
      return cb(err);
    }
    list = [];
    droplets.forEach(function (droplet) {
      if(droplet.name.indexOf(config.name) === 0) {
        list.push(droplet);
      }
    });
    console.log('droplets in app', list.length);
    cb(err, list);
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
    dropletCommands.list(false, function (err, list) {
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
    droplet.session.executeScript(path.resolve(SCRIPT_DIR, 'install.sh'), {
      onStdout: function (data) {
        process.stdout.write(data.toString());
      },
      onStderr: function (data) {
        process.stderr.write(data.toString());
      }
    }, function (e, code, log) {
      done(e);
    });
  }, function (e, r) {
    console.log('finished install');
    done(e, droplets);
  });
}

function userInstall(droplets, done) {
  if(!config.installScript) {
    console.log('-- no app install script --');
    return done(null, droplets);
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
    dropletCommands.list,
    createSessions,
    testSession,
    install,
    userInstall
  ], function (err, res) {
    console.log(err);
    console.log('-- finished setting up droplets--');

    if(typeof cb === 'function') {
      cb(err);
    } else {
      process.exit(0);
    }

  });
}

function pack(options, done) {
  console.log('-- packing code --');
  child.exec('npm pack ' + cwd, {
    cwd: path.resolve(cwd, '.node-deploy')
  }, function (err, stdout, stderr) {
    console.log(stdout);
    options.bundle = path.resolve(cwd, '.node-deploy', stdout.trim());
    done(err, options);
  });
}

function getSessions(options, done) {
  console.log('-- getting list of servers --');
  dropletCommands.list(true, function (err, droplets) {
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
  async.forEachSeries(options.droplets, function (droplet, done) {
    droplet.session.executeScript(path.join(SCRIPT_DIR, 'deploy.sh'), {
      onStdout: function (data) {
        process.stdout.write(data.toString());
      },
      onStderr: function (data) {
        process.stderr.write(data.toString());
      },
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
    process.exit(0);
  });
}

function selectDroplet(options, done) {
  console.log("select server");
  var list = select({
    multiSelect: false
  });
  var map = {};
  options.droplets.forEach(function (droplet, i) {
    list.option(droplet.networks.v4[0].ip_address);
    map[droplet.networks.v4[0].ip_address] = i;
  });
  list.list();
  list.on('select', function (selection) {
    options.droplet = options.droplets[map[selection[0].value]];

    done(null, options);
  });


  //list.on('keypress', function (key, item) {
  //  if(key.name === 'return') {
  //    console.log(item);
  //    //list.stop();
  //    options.droplets = [
  //      options.droplets[item]
  //    ];
  //    done(null, options);
  //  }
  //});

}

function showLogs(options, next) {
  //console.dir(options.droplets[0]);
  var droplet = options.droplet;
  droplet.session.execute('pm2 logs app', {
    onStdout: function (data) {
      process.stdout.write(data.toString());
    },
    onStderr: function (data) {
      process.stderr.write(data.toString());
    }
  });

  process.stdin.on('keypress', function () {
    console.log('=========== keypress =========');
  });

}

function openSilk(options, next) {
  var droplet = options.droplets[0];
  droplet.session.execute('silk', {
    onStdout: function (data) {
      process.stdout.write(data.toString());
    },
    onStderr: function (data) {
      process.stderr.write(data.toString());
    }
  });
}

function logs() {
  async.waterfall([
    function (next) {
      next(null, {});
    },
    getSessions,
    selectDroplet,
    showLogs
  ], function (e, r) {

  });
}

function restartApp(options, next) {
  var droplet = options.droplet;
  console.log('--- restarting ---');
  droplet.session.execute('pm2 restart 0', {
    onStdout: function (data) {
      process.stdout.write(data.toString());
    },
    onStderr: function (data) {
      process.stderr.write(data.toString());
    }
  }, function () {
    next(null, options);
  });
}


function restart() {
  console.log('--- restarting app ---');

  async.waterfall([
    function (next) {
      next(null, {});
    },
    getSessions,
    selectDroplet,
    restartApp
  ], function (e, r) {
    if(e) {
      console.log(e);
    }
    console.log('--- finished restarting ---');
    process.exit(0);
  });
}

function silk() {
  async.waterfall([
    function (next) {
      next(null, {});
    },
    getSessions,
    selectDroplet,
    openSilk
  ], function () {

  });
}

