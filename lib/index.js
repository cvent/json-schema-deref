var propSearch = require('prop-search');
var mpath = require('mpath');
var _ = require('lodash');
var clone = require('clone');
var async = require('async');
var utils = require('./utils');
var traverse = require('traverse-async').traverse;

var noop = function () {
};

var defaults = {
  cache: true,
  cacheTTL: 300000, // ms
  baseFolder: process.cwd()
};

var defaultKeys = Object.keys(defaults);

var loaders = {
  'web': require('./loaders/web'),
  'file': require('./loaders/file')
};

function getRefSchema(parent, refObj, options, fn) {
  var customLoaderOptions = _.pick(options, defaultKeys);

  var loader = typeof options.loader === 'function' ? options.loader : null;

  var refType = utils.getRefType(refObj);
  var refVal = utils.getRefValue(refObj);

  if (refType && loaders[refType]) {
    loaders[refType](refVal, options, function (err, newValue) {
      if (!err) {
        fn(err, newValue);
      }
      else if (loader) {
        loader(refVal, customLoaderOptions, fn);
      }
      else {
        fn(err);
      }
    });
  }
  else if (refType === 'local') {
    var newValue = utils.getRefPathValue(parent, refVal);
    fn(undefined, newValue);
  }
  else if (loader) {
    loader(refVal, customLoaderOptions, fn);
  }
  else {
    fn();
  }
}

function removeFromMissing(missing, refVal) {
  var missingIndex = missing.indexOf(refVal);
  if (missingIndex >= 0) {
    missing.splice(missingIndex, 1);
  }
}

function addToMissing(missing, refVal) {
  if (missing.indexOf(refVal) === -1) {
    missing.push(refVal);
  }
}

function derefSchema(schema, options, missing, fn) {
  var queue = traverse(schema, function (node, next) {
    if (node['$ref'] && typeof node['$ref'] === 'string') {
      var self = this;
      var refVal = utils.getRefValue(node);
      getRefSchema(schema, node, options, function (err, newValue) {
        if (newValue) {
          derefSchema(newValue, options, missing, function (err, value) {
            var obj;

            if (self.parent && self.parent[self.key]) {
              obj = self.parent;
            }
            else if (self.node && self.node[self.key]) {
              obj = self.node;
            }

            if (obj && (value || newValue)) {
              obj[self.key] = value || newValue;

              removeFromMissing(missing, refVal);
            }
            else if (self.isRoot && (value || newValue)) {
              // special case of root schema being replaced
              removeFromMissing(missing, refVal);
              queue.break();
              return fn(null, value || newValue)
            }
            else {
              addToMissing(missing, refVal);
            }

            return next();
          });
        }
        else {
          addToMissing(missing, refVal);

          return next();
        }
      });
    }
    else {
      return next();
    }
  }, function (newObject) {
    return fn(undefined, newObject);
  });
}

/**
 * Derefs `$ref`'s in json schema to actual resolved values.
 * Supports local, file and web refs.
 * @param schema The json schema
 * @param options
 *          baseFolder - the base folder to get relative path files from. Default is `process.cwd()`
 *          cache - whether to cache the result from the request. true if to cache, false otherwise.
 *          cacheTTL - the time to keep request result in cache. Default is 5 minutes.
 *          loader - a function for custom loader. Invoked if we could not resolve the ref type, or if there was an
 *                   error resolving a web or file ref types.
 *                   function with signature: `function(refValue, options, fn)`
 *                      refValue - the string value of the ref being resolved. Ex: `db://my_database_id`
 *                      options - options parameter passed to `deref`
 *                      fn - the final callback function, in form `function(err, newValue)`
 *                           err - err if ref is valid for the loader but there was an error resolving the ref
 *                           newValue - the resolved ref value, or null/undefined if the ref isn't for this custom
 *                                      loader and we should just leave the $ref as is.
 * @param fn
 * @returns {*}
 */
function deref(schema, options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = {};
  }

  if (!fn) fn = noop;

  options = _.defaults(options, defaults);

  var baseSchema = clone(schema);

  var missing = [];

  return derefSchema(baseSchema, options, missing, fn);
}

deref.prototype.getRefPathValue = utils.getRefPathValue;

module.exports = deref;