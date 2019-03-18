/**
 * Created by jaumard on 12/05/2015.
 */
const _ = require('lodash')

module.exports = {
  bindToSails: function (cb) {
    return function(err, modules) {
      if (err) {return cb(err);}
      _.each(modules, function(moduleDef) {
        // Add a reference to the Sails app that loaded the module
        moduleDef.sails = sails;
        // Bind all methods to the module context
        _.bindAll(moduleDef);
      });
      return cb(undefined, modules);
    };
  }
}
