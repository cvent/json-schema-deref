var fs = require('fs');
var clone = require('clone');
var path = require('path');

var utils = require('../utils');

var cwd = process.cwd();

var noop = function () {
};

function readFile(filePath, fn) {
  fs.readFile(filePath, function (err, data) {
    var newValue;

    try {
      newValue = JSON.parse(data);
    }
    catch (e) {
      err = e;
    }

    return fn(err, newValue);
  });
}

/**
 * Resolves a file link of a json schema to the actual value it references
 * @param refValue the value. String. Ex. `/some/path/schema.json#/definitions/foo`
 * @param options
 *              baseFolder - the base folder to get relative path files from. Default is `process.cwd()`
 * @param fn  callback (err, newValue)
 *              `newValue` is resolved value. If not found it's undefined
 * @returns {*}
 */
module.exports = function (refValue, options, fn) {
  if (!fn) fn = noop;

  var refPath = refValue;
  var baseFolder = options.baseFolder ? path.resolve(cwd, options.baseFolder) : cwd;

  if (refPath.indexOf('file:') === 0) {
    refPath = refPath.substring(5);
  }
  else {
    refPath = path.resolve(baseFolder, refPath);
  }

  var filePath = refPath;
  var hashIndex = filePath.indexOf('#');
  if (hashIndex > 0) {
    filePath = refPath.substring(0, hashIndex);
  }

  var finishIt = function (err, fileValue) {
    var newVal;
    if (!err && fileValue) {
      if (hashIndex > 0) {
        refPath = refPath.substring(hashIndex);
        var refNewVal = utils.getRefPathValue(fileValue, refPath);
        if (refNewVal) {
          newVal = refNewVal;
        }
      }
      else {
        newVal = fileValue;
      }
    }
    return fn(err, newVal);
  };

  if (filePath.indexOf('.json') >= 0) {
    var reqValue;
    try {
      reqValue = require(filePath);
    }
    catch (e) {
    }

    if (reqValue) {
      return finishIt(null, clone(reqValue));
    }
    return readFile(filePath, finishIt);
  }
  else {
    return readFile(filePath, finishIt);
  }
};