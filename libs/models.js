/**
 * Load models from a directory into a Sails app
 */

const util = require('./utils');
const colors = require('colors');
const includeAll = require('include-all');

module.exports = function (sails, dir, cb) {

  // Get the main model files
  includeAll.optional({
    dirname   : dir,
    filter    : /^(.+)\.(?:(?!md|txt).)+$/,
    replaceExpr : /^.*\//,
    flatten: true
  }, function(err, models) {
    if (err) { return cb(err); }

    // ---------------------------------------------------------
    // Get any supplemental files (BACKWARDS-COMPAT.)
    includeAll.optional({
      dirname   : dir,
      filter    : /(.+)\.attributes.json$/,
      replaceExpr : /^.*\//,
      flatten: true
    }, util.bindToSails(function(err, supplements) {
      if (err) {
        console.log(colors.red('Failed to load plugin\'s models'));
        console.log(err);
        if (err.code === 'include-all:DUPLICATE' && err.duplicateIdentity) {
          return cb(new Error(
            '\n-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\n'+
            'Attempted to load two models with the same identity (`' + err.duplicateIdentity + '`).  Please rename one of the files.\n'+
            'The model identity is the lower-cased version of the filename.\n'+
            '-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\n'));
        }
        return cb(err);
      }

      if (_.keys(supplements).length > 0) {
        sails.log.debug('The use of `.attributes.json` files is deprecated, and support will be removed in a future release of Sails.');
      }

      const modelDefs = _.merge(models, supplements)

      // Update the dictionary of models stored on our hook (`sails.hooks.orm.models`).
      // Note that the reference on the app instance (`sails.models`) is just an alias of this.
      _.extend(sails.hooks.orm.models, modelDefs);

      // Loop through models and coerce `connection` to `datastore` with a warning.
      _.each(sails.hooks.orm.models, function(modelDef, modelIdentity) {
        if (modelDef.connection) {
          sails.log.debug('In model `' + modelIdentity + '`: the `connection` setting is deprecated.  Please use `datastore` instead.\n');
          modelDef.datastore = modelDef.connection;
        }
      });

      return cb(null);
    }));
    // ---------------------------------------------------------
  });
}
