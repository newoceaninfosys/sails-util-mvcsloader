/**
 * Load services from a directory into a Sails app
 */

const async = require('async')
const _ = require('lodash')
const buildDictionary = require('sails-build-dictionary')

module.exports = function (sails, dir, cb) {
  async.waterfall([function loadServicesFromDirectory (next) {
    buildDictionary.optional({
      dirname: dir,
      filter: /^([^.]+)\.(js|coffee|litcoffee)$/,
      replaceExpr: /^.*\//,
      flattenDirectories: true
    }, next)
  }, function injectServicesIntoSails (modules, next) {
    sails.services = _.merge(modules || {}, sails.services || {})

    if (sails.config.globals.services) {
      _.each(modules, function (service, serviceId) {
        global[service.globalId] = service
      })
    }

    return next(null)
  }], function (err) {
    return cb(err)
  })
}
