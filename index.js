const async = require("async");

module.exports = function(sails) {
  if (!sails) {
    console.log("Warning! The Sails app injected into sails-util-mvcsloader seems invalid.");
  }

  let Loader = {

    defaults: {},

    injectPolicies: function(dir, loadPoliciesCallBack) {
      require(__dirname + "/libs/policies")(sails, dir, loadPoliciesCallBack);
    },
    injectConfig: function(dir, cb) {
      require(__dirname + "/libs/config")(sails, dir, cb);
    },

    injectControllers: function(dir, cb) {
      require(__dirname + "/libs/controllers")(sails, dir, cb);
    },

    injectModels: function(dir, cb) {
      require(__dirname + "/libs/models")(sails, dir, cb);
    },

    injectServices: function(dir, cb) {
      require(__dirname + "/libs/services")(sails, dir, cb);
    },

    injectHelpers: function(dir, cb) {
      require(__dirname + "/libs/helpers")(sails, dir, cb);
    },

    injectViews: function(dir, cb) {
      require(__dirname + "/libs/views")(sails, dir, cb);
    },

    // Inject config and policies synchronously into the Sails app
    configure: function(dir, cb, loadPoliciesCallBack) {
      if (!dir) {
        dir = {
          config: __dirname + "/../../config",
          policies: __dirname + "/../../api/policies"
        };
      }
      this.injectAll(dir, cb, loadPoliciesCallBack);
    },

    // Inject models, controllers & services asynchronously into the Sails app
    inject: function(dir, next, loadPoliciesCallBack) {
      // No parameters or only a callback (function) as first parameter
      if ((typeof dir === "function" || !dir) && !next) {
        let tmp = next;
        next = dir || function() {
        };
        dir = tmp || {
          models: __dirname + "/../../api/models",
          controllers: __dirname + "/../../api/controllers",
          services: __dirname + "/../../api/services",
          helpers: __dirname + "/../../api/helpers",
          // config: __dirname + "/../../api/config",
          // policies: __dirname + "/../../api/policies",
        };
      }

      // Backward compatibility, next and dir inverted
      else if (typeof next === "object" && typeof dir === "function") {
        let tmp = next;
        next = dir;
        dir = tmp;
      }

      // Be sure to have a callback
      next = next || function() {
      };

      this.injectAll(dir, next, loadPoliciesCallBack);
    },

    injectAll: function(dir, cb, loadPoliciesCallBack) {
      cb = cb || function() {
      };

      let self = this;

      let loadModels = function(next) {
        self.injectModels(dir.models, function(err) {
          if (err) {
            return next(err);
          }
          sails.log.info("Models are loaded from " + dir.models + ".");
          return next(null);
        });
      };

      let loadControllers = function(next) {
        self.injectControllers(dir.controllers, function(err) {
          if (err) {
            return next(err);
          }

          sails.log.info("Controllers are loaded from " + dir.controllers + ".");

          return next(null);
        });
      };

      let loadServices = function(next) {
        self.injectServices(dir.services, function(err) {
          if (err) {
            return next(err);
          }
          sails.log.info("Services are loaded from " + dir.services + ".");
          return next(null);
        });
      };

      let loadHelpers = function(next) {
        self.injectHelpers(dir.helpers, function(err) {
          if (err) {
            return next(err);
          }
          sails.log.info("Helpers are loaded from " + dir.helpers + ".");
          return next(null);
        });
      };

      let loadPolicies = function(next) {
        if (dir.policies) {
          self.injectPolicies(dir.policies, function(error, modules) {
            if (error) {
              return next(error);
            }
            loadPoliciesCallBack(null, modules);
            sails.log.info("Policies and Config are loaded from " + dir.policies + ".");
            return next(null);
          });
        } else {
          loadPoliciesCallBack(null, []);
          sails.log.info("Policy configs are loaded");
          return next(null);
        }
      };

      let loadConfigs = function(next) {
        next(null);
      };

      if (dir.config) {
        loadConfigs = function(next) {
          self.injectConfig(dir.config, function(error) {
            sails.log.info("Config loaded are from " + dir.config + ".");
            next(error);
          });
        };
      }

      let loadViews = function(next) {
        self.injectViews(dir.views, function(err) {
          if (err) {
            return next(err);
          }
          sails.log.info("Views are loaded from " + dir.views + ".");
          return next(null);
        });
      };

      let toLoad = [];

      if (dir.config) {
        toLoad.push(loadConfigs);
      }

      toLoad.push(loadPolicies);

      if (dir.models) {
        toLoad.push(loadModels);
      }

      if (dir.controllers) {
        toLoad.push(loadControllers);
      }

      if (dir.services) {
        toLoad.push(loadServices);
      }

      if (dir.helpers) {
        toLoad.push(loadHelpers);
      }

      if (dir.views) {
        toLoad.push(loadViews);
      }

      async.parallel(toLoad, function(err) {
        if (err) {
          sails.log.error(err);
        }
        if (cb) {
          cb(err);
        }
      });
    }
  };

  // Backward compatibility
  Loader.adapt = Loader.inject;

  return Loader;
};
