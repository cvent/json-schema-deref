describe('json-schema-deref', function () {
  var expect = require('chai').expect;
  var deref = require('../lib');
  var path = require('path');
  var fsx = require('fs.extra');
  var async = require('async');

  var tempFolder = '/var/tmp/json-deref-schema-tests/';
  before(function (done) {
    var srcfiles = ['id.json', 'foo.json', 'bar.json'];
    fsx.mkdirpSync(tempFolder);
    async.eachSeries(srcfiles, function (filePath, cb) {
      var srcFile = path.resolve(path.join(__dirname, './schemas', filePath));
      var desFile = path.join('/var/tmp/json-deref-schema-tests/', filePath);
      fsx.copy(srcFile, desFile, cb);
    }, done);
  });

  after(function (done) {
    fsx.rmrf(tempFolder, done);
  });

  describe('deref', function () {
    it('should work with basic schema', function (done) {
      var basicSchema = require('./schemas/basic');

      deref(basicSchema, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(basicSchema);
        done();
      });
    });

    it('should work with basic local refs', function (done) {
      var input = require('./schemas/localrefs');
      var expected = require('./schemas/localrefs.expected.json');

      deref(input, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with basic file refs and relative baseFolder', function (done) {
      var input = require('./schemas/basicfileref');
      var expected = require('./schemas/basic');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with basic file refs and absolute + relative baseFolder', function (done) {
      var input = require('./schemas/basicfileref');
      var expected = require('./schemas/basic');

      deref(input, {baseFolder: __dirname + '/./schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with basic file refs and absolute baseFolder', function (done) {
      var input = require('./schemas/basicfileref');
      var expected = require('./schemas/basic');

      deref(input, {baseFolder: path.join(__dirname, 'schemas')}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with local and file refs', function (done) {
      var input = require('./schemas/localandfilerefs');
      var expected = require('./schemas/localrefs.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with absolute files', function (done) {
      var input = require('./schemas/filerefs');
      var expected = require('./schemas/basic.json'); // same expected output

      deref(input, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with absolute files with # at end', function () {
      var input = require('./schemas/filerefswithhash');
      var expected = require('./schemas/basic.json');

      deref(input, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with simple web refs', function (done) {
      var input = require('./schemas/webrefs');
      var expected = require('./schemas/localrefs.expected.json');

      deref(input, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with simple web refs ended with #', function (done) {
      var input = require('./schemas/webrefswithhash');
      var expected = require('./schemas/localrefs.expected.json');

      deref(input, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with web and local mixed refs', function (done) {
      var input = require('./schemas/webwithlocal');
      var expected = require('./schemas/webwithlocal.expected.json');

      deref(input, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with simple web refs ended with # and option', function (done) {
      var input = require('./schemas/webrefswithhash');
      var expected = require('./schemas/webrefswithhash.expected.json');

      deref(input, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with web refs with json pointers', function (done) {
      var input = require('./schemas/webrefswithpointer');
      var expected = require('./schemas/webrefswithpointer.expected.json');

      deref(input, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with file refs with json pointers', function (done) {
      var input = require('./schemas/filerefswithpointer');
      var expected = require('./schemas/webrefswithpointer.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with nested json pointers', function (done) {
      var input = require('./schemas/api.props.json');
      var expected = require('./schemas/api.props.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with nested json pointers to files and links ref to files', function (done) {
      var input = require('./schemas/api.linksref.json');
      var expected = require('./schemas/api.linksref.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with nested json pointers to files with redirect to file in an array', function (done) {
      var input = require('./schemas/arrayfileref.json');
      var expected = require('./schemas/arrayfileref.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with deep links', function (done) {
      var input = require('./schemas/apideeplink.json');
      var expected = require('./schemas/apideeplink.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with deep nested ref links', function (done) {
      var input = require('./schemas/apinestedrefs.json');
      var expected = require('./schemas/apinestedrefs.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with custom loader', function (done) {
      var input = require('./schemas/customtype.json');
      var expected = require('./schemas/customtype.expected.json');

      var customLoader = function (ref, options, fn) {
        if (ref.indexOf('db:') === 0) {
          var value = {
            "description": "custom unique identifier of a the object",
            "type": "string",
            "minLength": 1,
            "readOnly": true
          };

          return fn(null, value);
        }

        return fn(null);
      };

      var options = {
        baseFolder: './test/schemas',
        loader: customLoader
      };

      deref(input, options, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with custom loader and unknown type', function (done) {
      var input = require('./schemas/customunknown.json');
      var expected = require('./schemas/customunknown.expected.json');

      var customLoader = function (ref, options, fn) {
        if (ref.indexOf('db:') === 0) {
          var value = {
            "description": "custom unique identifier of a the object",
            "type": "string",
            "minLength": 1,
            "readOnly": true
          };

          return fn(null, value);
        }

        return fn(null);
      };

      var options = {
        baseFolder: './test/schemas',
        loader: customLoader
      };

      deref(input, options, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with missing properties', function (done) {
      var input = require('./schemas/missing.json');
      var expected = require('./schemas/missing.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with anyOf array properties', function (done) {
      var input = require('./schemas/anyofref.json');
      var expected = require('./schemas/anyofref.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with top level custom property', function (done) {
      var input = require('./schemas/toplevelcustom.json');
      var expected = require('./schemas/toplevelcustom.expected.json');

      var customLoader = function (ref, options, fn) {
        if (ref.indexOf('urn:') >= 0) {
          var value = {
            "type": "object",
            "properties": {
              "baz": {
                "type": "string"
              }
            }
          };

          return fn(null, value);
        }

        return fn(null);
      };

      var options = {
        baseFolder: './test/schemas',
        loader: customLoader
      };

      deref(input, options, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with dots (.) in properties', function (done) {
      var input = require('./schemas/dotprop.json');
      var expected = require('./schemas/dotprop.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with top level ref properties', function (done) {
      var input = require('./schemas/toplevel.json');
      var expected = require('./schemas/toplevel.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.not.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    // TODO This really should return an error ?
    it('should work with local circular ref properties', function (done) {
      var input = require('./schemas/circularlocalref.json');
      var expected = require('./schemas/circularlocalref.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(schema).to.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with local self referencing properties', function (done) {
      var input = require('./schemas/circularself.json');
      var expected = require('./schemas/circularself.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.be.ok;
        expect(err).to.be.an.instanceOf(Error);
        done();
      });
    });

    it('should work with circular file ref properties', function (done) {
      var input = require('./schemas/circular-file-root.json');
      var expected = require('./schemas/circular-file-root.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.be.ok;
        expect(err).to.be.an.instanceOf(Error);
        done();
      });
    });

    it('should work with array refs in file', function (done) {
      var input = require('./schemas/filerefarray-schema1.json');
      var expected = require('./schemas/filerefarray.expected.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(schema).to.be.ok;
        expect(schema).to.deep.equal(expected);
        done();
      });
    });

    it('should work with cyclycal object', function (done) {
      var input = require('./schemas/cyclicaljs.json');

      deref(input, {baseFolder: './test/schemas'}, function (err, schema) {
        expect(err).to.be.ok;
        expect(err).to.be.an.instanceOf(Error);
        done();
      });
    });
  });
});