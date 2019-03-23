/**
 * Load models from a directory into a Sails app
 */

const util = require("./utils");
const colors = require("colors");
const includeAll = require("include-all");

module.exports = function(sails, dir, cb) {
  includeAll.optional({
    dirname: dir,
    filter: /^(.+)\.(?:(?!md|txt).)+$/,
    replaceExpr: null,
    dontLoad: true
  }, function(err, detectedViews) {
    if (err) {
      return cb(err);
    }

    // Save existence tree in `sails.views` for consumption later
    sails.views = detectedViews || {};

    return cb(null, detectedViews);
  });
};
