var propSearch = require('prop-search');
var mpath = require('mpath');
var _ = require('lodash');
var clone = require('clone');
var async = require('async');
var utils = require('./utils');

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

function derefSchema(schema, parentSchema, parentRef, options, fn) {
  var customLoaderOptions = _.pick(options, defaultKeys);

  var loader = typeof options.loader === 'function' ? options.loader : null;

  var setRefValue = function (cr, nval) {
    var path = cr.path;
    var schemaToSet = schema;

    // set parent if needed
    if (!path && parentRef && parentRef.path && parentSchema) {
      path = parentRef.path;
      schemaToSet = parentSchema;
    }

    if (path && schemaToSet) {
      var cv = mpath.get(path, schemaToSet);
      // check invalid overwrite
      if (utils.isRefObject(nval) && !utils.isRefObject(cv)) {
        return;
      }

      mpath.set(path, nval, schemaToSet);
    }
  };

  var refs = propSearch.searchForExistence(schema, '$ref', {separator: '.'});

  //console.log('lllllll');
  //console.dir(schema);
  //console.dir(refs);

  if (refs && refs.length > 0) {
    async.eachSeries(refs, function (currRef, ascb) {
      var refType = utils.getRefType(currRef);
      var refVal = utils.getRefValue(currRef);

      var doCustomLoader = function () {
        loader(refVal, customLoaderOptions, function (err, newValue) {
          if (!err && newValue) {
            setRefValue(currRef, newValue);
          }
          ascb(err);
        });
      };

      var handleResult = function (newValue) {
        if (!newValue) {
          newValue = currRef.value;
        }

        // do not replace with self
        if (utils.isRefObject(newValue)) {
          var newRefVal = utils.getRefValue(newValue);
          var newRefType = utils.getRefType(newValue);
          if (newRefVal === refVal || newRefType === 'local') {
            return ascb();
          }
        }

        derefSchema(newValue, schema, currRef, options, function (err, newValueSchema) {
          if (!err) {
            setRefValue(currRef, newValueSchema);
          }
          ascb(err);
        });
      };

      if (refType && loaders[refType]) {
        loaders[refType](refVal, options, function (err, newValue) {
          if (!err) {
            handleResult(newValue);
          }
          else if (loader) {
            doCustomLoader();
          }
          else {
            ascb(err);
          }
        });
      }
      else if (refType === 'local') {
        var newValue = utils.getRefPathValue(schema, refVal);
        handleResult(newValue);
      }
      else if (loader) {
        doCustomLoader();
      }
    }, function (err) {
      return fn(err, schema);
    });
  }
  else {
    return fn(null, schema);
  }
}

/**
 * Derefs `$ref`'s in json schema to actual resolved values.
 * Supports local, file and web refs.
 * @param baseSchema The json schema
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
function deref(baseSchema, options, fn) {
  if (typeof options === 'function') {
    fn = options;
    options = {};
  }

  if (!fn) fn = noop;

  options = _.defaults(options, defaults);

  return derefSchema(clone(baseSchema), null, null, options, fn)
}

deref.prototype.getRefPathValue = utils.getRefPathValue;

module.exports = deref;