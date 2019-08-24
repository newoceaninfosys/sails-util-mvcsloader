/**
 * Created by jaumard on 12/05/2015.
 */
const _ = require('lodash')

module.exports = {
  bindToSails: function (cb) {
    return function (err, modules) {
      if (err) { return cb(err); }
      _.each(modules, function (moduleDef) {
        // Add a reference to the Sails app that loaded the module
        moduleDef.sails = sails;
        // Bind all methods to the module context
        _.bindAll(moduleDef);
      });
      return cb(undefined, modules);
    };
  },
  buildPolicyMap: function () {
    // Loop through the keys looking for the old-style "controller-based" policy config,
    // and if we find it then expand it out to the new style.
    _.each(_.without(_.keys(sails.config.policies), 'moduleDefinitions'), (key) => {

      // Is this a plain dictionary, e.g. UserController: { '*': true } ?
      if (_.isPlainObject(sails.config.policies[key])) {

        // Get the controller name by stripping off the (optional) trailing "Controller"
        var controller = key.replace(/Controller$/, '').toLowerCase();

        // For each item (i.e. action) in the dictionary, add an entry to the config.
        _.each(_.keys(sails.config.policies[key]), (action) => {

          // Get the policies to attach to this action.
          var policies = sails.config.policies[key][action];

          // Add the target/policies mapping to sails.config.policies
          sails.config.policies[controller + '/' + action.toLowerCase()] = policies;
        });

        // Remove the deprecated config key.
        delete sails.config.policies[key];

      }

      // Make sure all standalone action glob keys are lowercased.
      else if (key !== key.toLowerCase()) {

        sails.config.policies[key.toLowerCase()] = sails.config.policies[key];
        delete sails.config.policies[key];

      }

    });

    // Sort the policy keys alphabetically, ensuring that more restrictive
    // keys (e.g. user/foo) come after less restrictive (e.g. user/*).
    // Ignore `moduleDefinitions` since it is a special key used to allow
    // programmatic setting of policy functions.
    var actionsToProtect = _.without(_.keys(sails.config.policies), 'moduleDefinitions').sort();

    // Declare a "never allow" function to use when a policy of `false` is encountered.
    var neverAllow = function neverAllow(req, res) {
      return res.forbidden();
    };
    neverAllow._middlewareType = 'POLICY: false (neverAllow)';

    // Declare a "never allow" function to use when a policy of `false` is encountered.
    var alwaysAllow = function alwaysAllow(req, res, next) {
      return next();
    };
    alwaysAllow._middlewareType = 'POLICY: true (alwaysAllow)';

    // Loop through the keys and create the map.
    var mapping = _.reduce(actionsToProtect, (memo, target, index) => {

      // Allow bald `true` and `false` policies by wrapping them in an array.
      if (sails.config.policies[target] === true || sails.config.policies[target] === false) {
        sails.config.policies[target] = [sails.config.policies[target]];
      }

      // Make sure policies are contained in an array.
      if (!_.isArray(sails.config.policies[target])) {
        sails.config.policies[target] = [sails.config.policies[target]];
      }

      // Get the policies the user wants to add to this set of actions.
      // Note the use of _.compact to transform [undefined] into [].
      var policies = _.compact(_.map(sails.config.policies[target], (policy) => {
        // If the policy is `true`, make sure it's the only one for this target.
        if (policy === true) {
          if (sails.config.policies[target].length > 1) {
            throw flaverr({
              name: 'userError',
              code: 'E_INVALID_POLICY_CONFIG'
            }, new Error('Invalid policy setting for `' + target + '`: if `true` is specified, it must be the only policy in the array.'));
          }
          // Map `true` to  the "always allow" policy.
          return alwaysAllow;
        }
        // If the policy is `false`, make sure it's the only one for this target.
        if (policy === false) {
          if (sails.config.policies[target].length > 1) {
            throw flaverr({
              name: 'userError',
              code: 'E_INVALID_POLICY_CONFIG'
            }, new Error('Invalid policy setting for `' + target + '`: if `false` is specified, it must be the only policy in the array.'));
          }
          // Map `false` to  the "never allow" policy.
          return neverAllow;
        }
        // If the policy is a string, make sure it corresponds to one of the policies we loaded.
        if (_.isString(policy)) {
          if (!sails.hooks.policies.middleware[policy.toLowerCase()]) {
            throw flaverr({
              name: 'userError',
              code: 'E_INVALID_POLICY_CONFIG'
            }, new Error('Invalid policy setting for `' + target + '`: `' + policy + '` does not correspond to any of the loaded policies.'));
          }
          return sails.hooks.policies.middleware[policy.toLowerCase()];
        }
        // If the policy is a function, return it.
        if (_.isFunction(policy)) {
          policy._middlewareType = 'POLICY: ' + (policy.name || 'anonymous');
          return policy;
        }
        // Otherwise just bail.
        throw flaverr({
          name: 'userError',
          code: 'E_INVALID_POLICY_CONFIG'
        }, new Error('Invalid policy setting for `' + target + '`: a policy must be a string, a function or `false`.'));

      }));

      // Start an array of targets that this set of policies will be applied to or ignored for.
      var allowDenyList = [target];

      // If this is the global target, loop through the rest of the targets and exclude them
      // from this one.  We may change this behavior / make it optional in the future,
      // but for now policies are NOT cumulative.
      if (target === '*') {
        (function () {
          for (var i = index + 1; i < actionsToProtect.length; i++) {
            var nextTarget = actionsToProtect[i];
            allowDenyList.push('!' + nextTarget);
          }
        })();
      }

      // If this target is a wildcard, then any other target that matches it will
      // override it.  We may change this behavior / make it optional in the future,
      // but for now policies are NOT cumulative.
      else if (target.slice(-2) === '/*') {
        (function () {
          // Get a version of the target without the /*
          var nakedTarget = target.slice(0, -2);
          // Get a version of the target without the .
          var slashTarget = target.slice(0, -1);
          // If we already bound a policy to the naked target, then flag that the
          // current policy should _not_ be applied to it.
          if (memo[nakedTarget]) {
            allowDenyList.push('!' + nakedTarget);
          }
          // Now run through the rest of the targets in the list, and if any of them
          // start with the "slashTarget", make sure this policy does _not_ apply to them.
          // So if our target is `user/foo/*`, and we see `user/foo/bar` in the list,
          // we will add that to the blacklist for this policy.
          for (var i = index + 1; i < actionsToProtect.length; i++) {
            var nextTarget = actionsToProtect[i];
            if (nextTarget.indexOf(slashTarget) === 0) {
              allowDenyList.push('!' + nextTarget);
            }
            // As soon as we find a non-matching target, we're done (because they're
            // arranged in alphabetical order).
            else {
              break;
            }
          }
        })();
      }

      // Transform the allow/deny list into a comma-delimited string that can be
      // understood by `registerActionMiddleware`.
      memo[allowDenyList.join(',')] = policies;

      return memo;

    }, {});

    return mapping;
  },

  bindPolicies: function (hooker, modules) {
    // Add the loaded policies to our internal dictionary.
    _.extend(hooker.middleware, modules);
    _.extend(sails.hooks.policies.middleware, modules);

    // If any policies were specified when loading Sails, add those on
    // top of the ones loaded from disk.
    if (sails.config.policies && sails.config.policies.moduleDefinitions) {
      _.extend(hooker.middleware, sails.config.policies.moduleDefinitions);
    }

    // Validate that all policies are functions.
    try {
      _.each(_.keys(hooker.middleware), (policyName) => {
        // If we find a bad'n, bail out.
        if (!_.isFunction(sails.hooks.policies.middleware[policyName])) {
          throw flaverr({
            name: 'userError',
            code: 'E_INVALID_POLICY'
          }, new Error('Failed loading invalid policy `' + policyName + '` (expected a function, but got a `' + typeof (sails.hooks.policies.middleware[policyName]) + '`)'));
        }
      });
    } catch (e) {
      console.log(colors.red('Error occurred while loading plugin\'s policies'));
      console.log(e);
      // return cb(e);
    }

    // Set the _middlewareType property on each policy.
    _.each(hooker.middleware, (policyFn, policyName) => {
      policyFn._middlewareType = 'POLICY: ' + policyName;
    });

    // Build / normalize policy config
    this.mapping = this.buildPolicyMap();

    // Register action middleware for each item in the map
    _.each(this.mapping, (policies, targets) => {
      sails.registerActionMiddleware(policies, targets);
    });

    // Emit event to let other hooks know we're ready to go
    sails.log.silly('Policy-controller bindings complete!');
    sails.emit('hook:policies:bound');
  }
}
