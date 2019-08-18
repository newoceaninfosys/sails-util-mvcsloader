/**
 * Load helpers from a directory into a Sails app
 */

const _ = require('@sailshq/lodash');
const flaverr = require('flaverr');
const includeAll = require('include-all');
const colors = require('colors');

module.exports = function (sails, dir, done) {
  // Load helper defs out of the specified folder
  includeAll.optional({
    dirname: dir,
    filter: /^([^.]+)\.(?:(?!md|txt).)+$/,
    flatten: true,
    keepDirectoryPath: true
  }, function (err, helperDefs) {
    if (err) {
      console.log(colors.red('Failed to load plugin\'s helpers'));
      console.log(err);
      return done(err);
    }

    // If any helpers were specified when loading Sails, add those on
    // top of the ones loaded from disk.  (Experimental)
    if (sails.config.helpers.moduleDefinitions) {
      // Note that this is a shallow merge!
      _.extend(helperDefs, sails.config.helpers.moduleDefinitions);
    }

    const helperPrefix = "plugins" + "." + dir.split('/').reverse()[1];

    try {
      // Loop through each helper def, attempting to build each one as
      // a Callable (a.k.a. "wet machine")
      _.each(helperDefs, function (helperDef, identity) {
        try {
          // Camel-case every part of the file path, and join with dots
          // e.g. /user-helpers/foo/my-helper => userHelpers.foo.myHelper
          var keyPath = _.map(identity.split('/'), _.camelCase).join('.');
          keyPath = helperPrefix + "." + keyPath;

          // Save _loadedFrom property for debugging purposes.
          // (e.g. `financial/calculate-mortgage-series`)
          helperDef._loadedFrom = identity;

          // Save _fromLocalSailsApp for internal use.
          helperDef._fromLocalSailsApp = true;

          // Use filename-derived `identity` REGARDLESS if an explicit identity
          // was set.  (And exclude any extra hierarchy.)  Otherwise, as of
          // machine@v15, this could fail with an ImplementationError.
          helperDef.identity = identity.match(/\//) ? _.last(identity.split('/')) : identity;

          // Check helper def to make sure it doesn't include any obvious signs
          // of confusion with actions -- e.g. no "responseType".  If anything
          // like that is detected, log a warning.
          if (helperDef.files) {
            sails.log.warn(
              'Ignoring unexpected `files` property in helper definition loaded ' +
              'from ' + helperDef._loadedFrom + '.  This feature can only be used ' +
              'by actions, not by helpers!'
            );
          }
          var hasAnyConfusingExitProps = (
            _.isObject(helperDef.exits) &&
            _.any(helperDef.exits, function (exitDef) {
              return (
                _.isObject(exitDef) &&
                (
                  exitDef.responseType !== undefined ||
                  exitDef.viewTemplatePath !== undefined ||
                  exitDef.statusCode !== undefined
                )
              );
            })
          );
          if (hasAnyConfusingExitProps) {
            sails.log.warn(
              'Ignoring unexpected property in one of the exits of the helper ' +
              'definition loaded from ' + helperDef._loadedFrom + '.  Features like ' +
              '`responseType`, `viewTemplatePath`, and `statusCode` can only be ' +
              'used by actions, not by helpers!'
            );
          }

          // Build & expose helper on `sails.helpers`
          // > e.g. sails.helpers.userHelpers.foo.myHelper
          sails.hooks.helpers.furnishHelper(keyPath, helperDef);
        } catch (err) {
          // If an error occurs building the callable, throw here to bust
          // out of the _.each loop early
          throw flaverr({
            code: 'E_FAILED_TO_BUILD_CALLABLE',
            identity: helperDef.identity,
            loadedFrom: identity,
            raw: err
          }, err);
        }
      });//∞

    } catch (err) {

      // Handle any errors building Callables for our helpers by sending the
      // errors through the hook callback, which will cause Sails to halt lifting.
      if (flaverr.taste('E_FAILED_TO_BUILD_CALLABLE', err)) {
        return done(flaverr({
          message: 'Failed to load helper `' + err.loadedFrom + '` into a Callable!  ' + err.message
        }, err));
      } else {
        console.log(colors.red('Error occurred while loading plugin\'s helpers'));
        console.log(err);
        return done(err);
      }

    }//</ caught >

    // --• Everthing worked!
    return done();

  });
}
