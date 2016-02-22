var path = require('path'),
    fs   = require('fs');

var cwd = path.resolve('.');

// check for deploy.json
try {
  var file = fs.readFileSync(path.resolve(cwd, 'deploy.json'));
} catch (e) {
  console.log('No deploy.json. Make sure you are in the app\'s folder or create a deploy.json file.');
  process.exit(1);
}

try {
  var config = JSON.parse(file);
} catch (e) {
  console.log('Error parsing deploy.json. Please check the format.');
  process.exit(1);
}

module.exports = config;
