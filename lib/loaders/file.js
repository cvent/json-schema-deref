const fs = require('fs')
const path = require('path')
const { getRefFilePath } = require('../utils')

const cwd = process.cwd()

const noop = function noop () {}

function readFile (filePath, fn) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      return fn(err)
    }

    let newValue

    try {
      newValue = JSON.parse(data)
    } catch (e) {
      err = e
    }

    return fn(err, newValue)
  })
}

/**
 * Resolves a file link of a json schema to the actual value it references
 * @param {String} refValue the value. String. Ex. `/some/path/schema.json#/definitions/foo`
 * @param {Object} options tje options
 * @param {String} options.baseFolder the base folder to get relative path files from. Default is `process.cwd()`
 * @param {Function} fn callback (err, newValue). `newValue` is resolved value. If not found it's undefined
 * @private
 */
module.exports = function (refValue, options, fn) {
  if (!fn) {
    fn = noop
  }

  let refPath = refValue
  const baseFolder = options.baseFolder ? path.resolve(cwd, options.baseFolder) : cwd

  if (refPath.indexOf('file:') === 0) {
    refPath = refPath.substring(5)
  } else {
    refPath = path.resolve(baseFolder, refPath)
  }

  const filePath = getRefFilePath(refPath)

  function finishIt (err, fileValue) {
    let newVal
    if (!err && fileValue) {
      newVal = fileValue
    }

    return fn(err, newVal)
  }

  return readFile(filePath, finishIt)
}
