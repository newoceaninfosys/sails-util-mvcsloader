/**
 * Load services from a directory into a Sails app
 */

const async = require('async')
const _ = require('lodash')
const includeAll = require('include-all');
const util = require('./utils');
const colors = require('colors');

module.exports = function (sails, dir, cb) {
  includeAll.optional({
    dirname     : dir,
    filter      : /^(.+)\.(?:(?!md|txt).)+$/,
    depth     : 1,
    caseSensitive : true
  }, util.bindToSails(function(err, modules) {
    if (err) {
      console.log(colors.red('Failed to load plugin\'s services'));
      console.log(err);
      return cb(err);
    }

    // Expose services on `sails.services` to provide access even when globals are disabled.
    _.extend(sails.services, modules);

    // Expose globals (if enabled)
    if (sails.config.globals.services) {
      _.each(sails.services, function(service, identity) {
        var globalId = service.globalId || service.identity || identity;
        global[globalId] = service;
      });
    }

    // Relevant modules have finished loading.
    return cb();
  }));
}
