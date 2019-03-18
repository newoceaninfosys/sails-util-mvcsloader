/**
 * Load policies from a directory into a Sails app
 */

const _ = require('@sailshq/lodash');
const includeAll = require('include-all');
const util = require('./utils');

module.exports = function (sails, dir, cb) {
  includeAll.optional({
    dirname: dir,
    filter: /^(.+)\.(?:(?!md|txt).)+$/,
    replaceExpr: null,
    flatten: true,
    keepDirectoryPath: true
  }, util.bindToSails(function (err, modules) {
    if (err && cb) {
      return cb(err);
    }

    if (cb) {
      cb(null, modules);
    }
  }));
}
