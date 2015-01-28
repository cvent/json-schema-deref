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
  });
});