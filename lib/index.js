var _ = require('lodash');
var path = require('path');
var async = require('async');
var clone = require('clone');
var utils = require('./utils');
var traverseSync = require('traverse');
var traverse = require('traverse-async').traverse;

var noop = function () {
};

var defaults = {
  cache: true,
  cacheTTL: 300000, // ms
  baseFolder: process.cwd()
};

var defaultKeys = Object.keys(defaults);

var jsonSchemaKeywords = ['member', 'property', 'schema', 'targetschema', 'type', 'element', 'properties',
  'definitions'];

var loaders = {
  'web': require('./loaders/web'),
  'file': require('./loaders/file')
};

var cache = {};

function getRefSchema(refVal, refType, parent, options, state, fn) {
  var customLoaderOptions = _.pick(options, defaultKeys);

  var loader = typeof options.loader === 'function' ? options.loader : null;

  function loaderHandler(err, loaderValue) {
    if (!err && loaderValue) {
      var oldBasePath;

      if (refType === 'file') {
        var dirname = path.dirname(filePath);
        if (dirname === '.') {
          dirname = '';
        }

        if (dirname) {
          oldBasePath = state.cwd;
          var newBasePath = path.resolve(state.cwd, dirname);
          options.baseFolder = state.cwd = newBasePath;
        }
      }

      derefSchema(loaderValue, options, state, function (err, derefedValue) {
        // reset
        if (oldBasePath) {
          options.baseFolder = state.cwd = oldBasePath;
        }

        if (err) {
          return fn(err);
        }

        var newVal;

        if (derefedValue) {
          if (filePath && !cache[filePath]) {
            cache[filePath] = derefedValue;
          }

          if (refVal.indexOf('#') >= 0) {
            var refPaths = refVal.split('#');
            var refPath = refPaths[1];
            var refNewVal = utils.getRefPathValue(derefedValue, refPath);
            if (refNewVal) {
              newVal = refNewVal;
            }
          }
          else {
            newVal = derefedValue;
          }
        }

        return fn(null, newVal);
      });
    }
    else if (loader) {
      loader(refVal, customLoaderOptions, fn);
    }
    else {
      fn(err);
    }
  }

  if (refType && loaders[refType]) {
    var loaderValue;

    if (refType === 'file') {
      var filePath = utils.getRefFilePath(refVal);

      if (cache[filePath]) {
        loaderValue = cache[filePath];
        loaderHandler(null, loaderValue);
      }
      else {
        loaders[refType](refVal, options, loaderHandler);
      }
    }
    else {
      loaders[refType](refVal, options, loaderHandler);
    }
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


/**
 * Builds parental history of a node within an object. To be used in traversal.
 * @param node
 * @returns {*}
 */
function buildNodeHistory(node) {
  if (!node) {
    return [];
  }

  return _.chain(node.path).map(function (pathObj) {
    return pathObj.toLowerCase();
  }).difference(jsonSchemaKeywords).value();
}

function hasRefs(schema, missing, type) {
  var refs = [];
  traverseSync(schema).forEach(function (node) {
    if (node && node['$ref'] && typeof node['$ref'] === 'string') {
      var refVal = utils.getRefValue(node);
      var refType = utils.getRefType(node);
      if (refType && type) {
        if (refType === type) {
          refs.push(refVal);
        }
      }
      else {
        refs.push(refVal);
      }
    }
  });

  var diff = _.difference(refs, missing);
  return diff && diff.length > 0;
}

/**
 * Derefs schema
 * @param schema
 * @param options
 * @param state
 * @param fn
 */
function derefType(schema, options, state, type, fn) {
  if (typeof state === 'function') {
    fn = state;
    state = null;
  }

  if (state.circular) {
    return fn(new Error('circular references found: ' + state.circularRefs.toString()), null);
  }

  function finalCb(newObject) {
    var error;
    if (state.circular) {
      error = new Error('circular references found: ' + state.circularRefs.toString());
    }
    return fn(error, newObject);
  }

  var queue = traverse(schema, function (node, next) {
    if (node['$ref'] && typeof node['$ref'] === 'string') {
      var self = this;

      var refType = utils.getRefType(node);
      var refVal = utils.getRefValue(node);

      if (refType && refType != type) {
        return next();
      }

      if (refVal === '#') {
        // self referencing schema
        state.circular = true;
        state.circularRefs.push(refVal);
        return next();
      }

      var nodeHistory = buildNodeHistory({path: this.path.slice(0, -1)});

      var refPaths = refVal.split('/');
      var finalRef = refPaths[refPaths.length - 1] ? refPaths[refPaths.length - 1].toLowerCase() : null;

      if ((refType === 'local' && finalRef && nodeHistory.indexOf(finalRef) >= 0) ||
        (state.history.indexOf(refVal) >= 0)) {
        state.circular = true;
        state.circularRefs.push(refVal);
        return next();
      }
      else if (refType === 'file') {
        var filePath = utils.getRefFilePath(refVal);
        if (!path.isAbsolute(filePath) && state.cwd) {
          filePath = path.resolve(state.cwd, filePath);
        }

        if (state.history.indexOf(filePath) >= 0) {
          state.circular = true;
          state.circularRefs.push(filePath);
          this.update(node, true);
          return;
        }
      }

      state.history.push(refVal);

      getRefSchema(refVal, refType, schema, options, state, function (err, newValue) {
        if (!err && newValue) {
          var obj;

          if (self.parent && self.parent[self.key]) {
            obj = self.parent;
          }
          else if (self.node && self.node[self.key]) {
            obj = self.node;
          }

          if (obj && newValue) {
            obj[self.key] = newValue;
            if (state.circularRefs.indexOf(refVal) === -1) {
              state.history.pop();
            }
            if (state.missing.indexOf(refVal) !== -1) {
              state.missing.splice(state.missing.indexOf(refVal), 1);
            }
          }
          else if (self.isRoot && newValue) {
            // special case of root schema being replaced
            state.history.pop();
            if (state.missing.indexOf(refVal) === -1) {
              if (state.circularRefs.indexOf(refVal) !== -1) {
                state.circularRefs.splice(state.circularRefs.indexOf(refVal), 1);
              }
              state.missing.push(refVal);
            }

            queue.break();
            return finalCb(newValue)
          }

          return next();
        }
        else if (!err && !newValue) {
          state.history.pop();
          if (state.missing.indexOf(refVal) === -1) {
            if (state.circularRefs.indexOf(refVal) !== -1) {
              state.circularRefs.splice(state.circularRefs.indexOf(refVal), 1);
            }
            state.missing.push(refVal);
          }

          return next();
        }
        else {
          return next();
        }
      });
    }
    else {
      return next();
    }
  }, finalCb);
}


function derefSchema(schema, options, state, fn) {
  function finalCb(newObject) {
    var error;
    if (state.circular) {
      error = new Error('circular references found: ' + state.circularRefs.toString());
    }
    return fn(error, newObject);
  }

  state.missing = [];

  function doType(type, tfn) {
    async.whilst(function () {
      return !state.circular && hasRefs(schema, state.missing, type);
    }, function (wcb) {
      derefType(schema, options, state, type, function (err, derefed) {
        schema = derefed;
        return wcb();
      });
    }, tfn);
  }

  async.series([
    function (scb) {
      doType('file', scb);
    },
    function (scb) {
      doType('web', scb);
    },
    function (scb) {
      doType('local', scb);
    }
  ], function (err) {
    return finalCb(schema)
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

  var bf = options.baseFolder;
  var cwd = bf;
  if (!path.isAbsolute(bf)) {
    cwd = path.resolve(process.cwd(), bf);
  }

  var state = {
    circular: false,
    history: [],
    circularRefs: [],
    cwd: cwd,
    missing: []
  };

  var baseSchema = clone(schema);

  cache = {};

  return derefSchema(baseSchema, options, state, fn);
}

deref.prototype.getRefPathValue = utils.getRefPathValue;

module.exports = deref;