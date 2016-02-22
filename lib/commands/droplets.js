var DigitalOceanApi = require('digital-ocean-api');

var config = require('../config.js');

var api = new DigitalOceanApi({
  token: config.token
});

module.exports = {
  /**
   * Gets a list of droplets for the app and optionally
   * logs the count.
   *
   * @param log {boolean} - if true, logs the count
   * @param cb {function}
   */
  list: function (log, cb) {

    if(typeof log === 'function') {
      cb = log;
      log = true;
    }

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

      if(log) {
        //TODO: text singular when 1 droplet
        console.log(list.length + ' droplets in app');
      }

      cb(err, list);
    });
  }
};
