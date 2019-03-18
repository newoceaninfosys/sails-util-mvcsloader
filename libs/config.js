/**
 * Load config from a directory into a Sails app
 */

const includeAll = require('include-all');
const _ = require('lodash');
const colors = require('colors');
const mergeDictionaries = require('merge-dictionaries');

module.exports = function (sails, dir) {
  includeAll.aggregate({
    dirname   : dir,
    exclude   : ['locales', /local\..+/],
    excludeDirs: /(locales|env)$/,
    flatten   : true,
    keepDirectoryPath: true,
    identity  : false
  }, function (err, userConfig) {
    if (err) {
      console.log(colors.red('Failed to load plugin\'s configs'));
      console.log(err);
      return;
    }
    // sails.config = _.merge(configs, sails.config, (a, b) => _.isArray(a) ? a.concat(b) : undefined)
    // // Using this hack to reset and bind our policies to router
    // sails._actionMiddleware = [];
    // sails.router.flush();

    let config = {};
    const overrides = _.clone(sails.config);

    // Merge the overrides into the loaded user config.
    config = mergeDictionaries(overrides, userConfig);

    // Ensure final configuration object is valid
    // (in case moduleloader fails miserably)
    config = _.isObject(config) ? config : (sails.config || {});

    // Save final config into sails.config
    sails.config = config;

    console.log('sails.config.policies', sails.config.policies)
  })
};

