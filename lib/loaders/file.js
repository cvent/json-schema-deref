var fs = require('fs');
var clone = require('clone');
var path = require('path');

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

module.exports = function (refValue, options, fn) {
  if (!fn) fn = noop;

  var refPath = refValue;
  var cwd = process.cwd();
  var baseFolder = options.baseFolder ? path.resolve(cwd, options.baseFolder) : cwd;

  if (refPath.indexOf('file:') === 0) {
    refPath = refPath.substring(5);
  }
  else {
    refPath = path.resolve(baseFolder, refPath);
  }

  if (refPath.indexOf('.json') >= 0) {
    try {
      var newValue = require(refPath);
      if (newValue) {
        return fn(null, clone(newValue));
      }
      return readFile(refPath, fn);
    }
    catch (e) {
      // module not found
      return readFile(refPath, fn);
    }
  }
  else {
    return readFile(refPath, fn);
  }
};