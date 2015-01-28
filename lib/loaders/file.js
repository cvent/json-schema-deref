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

  var hashIndex = refPath.indexOf('#');
  if (hashIndex > 0) {
    refPath = url.substring(0, hashIndex);
  }

  var finishIt = function (err, fileValue) {
    var newVal;
    if (!err && fileValue) {
      newVal = fileValue;
      if (hashIndex > 0) {
        var refPath = url.substring(hashIndex);
        var refNewVal = utils.getRefPathValue(body, refPath);
        if (refNewVal) {
          newVal = refNewVal;
        }
      }
    }
    return fn(err, newVal);
  };

  if (refPath.indexOf('.json') >= 0) {
    try {
      var newValue = require(refPath);
      if (newValue) {
        return finishIt(null, clone(newValue));
      }
      return readFile(refPath, finishIt);
    }
    catch (e) {
      // module not found
      return readFile(refPath, finishIt);
    }
  }
  else {
    return readFile(refPath, finishIt);
  }
};