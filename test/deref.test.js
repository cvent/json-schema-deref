import path from 'path';
import asl from 'async';
import test from 'ava';
import * as fsx from 'fs.extra';
import deref from '../dist/index';

const tempFolder = '/var/tmp/json-deref-schema-tests/';
const srcfiles = ['id.json', 'foo.json', 'bar.json'];

function check(t, expected) {
  return function checkResult(err, schema) {
    t.falsy(err);
    t.deepEqual(schema, expected);
    t.end();
  };
}

test.cb.before(t => {
  fsx.rmrfSync(tempFolder);
  fsx.mkdirpSync(tempFolder);
  asl.eachSeries(srcfiles, (filePath, cb) => {
    const srcFile = path.resolve(path.join(__dirname, './schemas', filePath));
    const desFile = path.join('/var/tmp/json-deref-schema-tests/', filePath);
    fsx.copy(srcFile, desFile, cb);
  }, t.end);
});

test.cb('should work with basic schema', t => {
  const basicSchema = require('./schemas/basic');

  deref(basicSchema, check(t, basicSchema));
});

test.cb('should work with basic local refs', t => {
  const input = require('./schemas/localrefs');
  const expected = require('./schemas/localrefs.expected.json');

  deref(input, check(t, expected));
});

test.cb('should work with basic file refs and relative baseFolder', t => {
  const input = require('./schemas/basicfileref');
  const expected = require('./schemas/basic');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with basic file refs and absolute + relative baseFolder', t => {
  const input = require('./schemas/basicfileref');
  const expected = require('./schemas/basic');

  deref(input, { baseFolder: __dirname.concat('/./schemas') }, (err, schema) => {
    t.falsy(err);
    t.deepEqual(schema, expected);
    t.end();
  });
});

test.cb('should work with basic file refs and absolute baseFolder', t => {
  const input = require('./schemas/basicfileref');
  const expected = require('./schemas/basic');
  const folder = path.join(__dirname, 'schemas');
  deref(input, { baseFolder: folder }, check(t, expected));
});

test.cb('should work with local and file refs', t => {
  const input = require('./schemas/localandfilerefs');
  const expected = require('./schemas/localrefs.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with absolute files', t => {
  const input = require('./schemas/filerefs');
  const expected = require('./schemas/basic.json'); // same expected output

  deref(input, check(t, expected));
});

test.cb('should work with absolute files with # at end', t => {
  const input = require('./schemas/filerefswithhash');
  const expected = require('./schemas/basic.json');

  deref(input, check(t, expected));
});

test.cb('should work with simple web refs', t => {
  const input = require('./schemas/webrefs');
  const expected = require('./schemas/localrefs.expected.json');

  deref(input, check(t, expected));
});

test.cb('should work with simple web refs ended with #', t => {
  const input = require('./schemas/webrefswithhash');
  const expected = require('./schemas/localrefs.expected.json');

  deref(input, check(t, expected));
});

test.cb('should work with web and local mixed refs', t => {
  const input = require('./schemas/webwithlocal');
  const expected = require('./schemas/webwithlocal.expected.json');

  deref(input, check(t, expected));
});

test.cb('should work with simple web refs ended with # and option', t => {
  const input = require('./schemas/webrefswithhash');
  const expected = require('./schemas/webrefswithhash.expected.json');

  deref(input, check(t, expected));
});

test.cb('should work with web refs with json pointers', t => {
  const input = require('./schemas/webrefswithpointer');
  const expected = require('./schemas/webrefswithpointer.expected.json');

  deref(input, check(t, expected));
});

test.cb('should work with file refs with json pointers', t => {
  const input = require('./schemas/filerefswithpointer');
  const expected = require('./schemas/webrefswithpointer.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with nested json pointers', t => {
  const input = require('./schemas/api.props.json');
  const expected = require('./schemas/api.props.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with nested json pointers to files and links ref to files', t => {
  const input = require('./schemas/api.linksref.json');
  const expected = require('./schemas/api.linksref.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with nested json pointers to files with redirect to file in an array', t => {
  const input = require('./schemas/arrayfileref.json');
  const expected = require('./schemas/arrayfileref.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with deep links', t => {
  const input = require('./schemas/apideeplink.json');
  const expected = require('./schemas/apideeplink.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with deep nested ref links', t => {
  const input = require('./schemas/apinestedrefs.json');
  const expected = require('./schemas/apinestedrefs.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with custom loader', t => {
  const input = require('./schemas/customtype.json');
  const expected = require('./schemas/customtype.expected.json');

  const customLoader = function (ref, options, fn) {
    if (ref.indexOf('db:') === 0) {
      const value = {
        description: "custom unique identifier of a the object",
        type: "string",
        minLength: 1,
        readOnly: true
      };

      return fn(null, value);
    }

    return fn(null);
  };

  const options = {
    baseFolder: './schemas',
    loader: customLoader
  };

  deref(input, options, check(t, expected));
});

test.cb('should work with custom loader and unknown type', t => {
  const input = require('./schemas/customunknown.json');
  const expected = require('./schemas/customunknown.expected.json');

  const customLoader = function (ref, options, fn) {
    if (ref.indexOf('db:') === 0) {
      const value = {
        description: "custom unique identifier of a the object",
        type: "string",
        minLength: 1,
        readOnly: true
      };

      return fn(null, value);
    }

    return fn(null);
  };

  const options = {
    baseFolder: './schemas',
    loader: customLoader
  };

  deref(input, options, check(t, expected));
});

test.cb('should work with missing properties', t => {
  const input = require('./schemas/missing.json');
  const expected = require('./schemas/missing.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should error with missing properties if option specified', t => {
  const input = require('./schemas/missing.json');
  const expected = require('./schemas/missing.expected.json');

  deref(input, { baseFolder: './schemas', failOnMissing: true }, (err, schema) => {
    t.truthy(err instanceof Error);
    t.end();
  });
});

test.cb('should work with anyOf array properties', t => {
  const input = require('./schemas/anyofref.json');
  const expected = require('./schemas/anyofref.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with top level custom property', t => {
  const input = require('./schemas/toplevelcustom.json');
  const expected = require('./schemas/toplevelcustom.expected.json');

  const customLoader = function (ref, options, fn) {
    if (ref.indexOf('urn:') >= 0) {
      const value = {
        type: "object",
        properties: {
          baz: {
            type: "string"
          }
        }
      };

      return fn(null, value);
    }

    return fn(null);
  };

  const options = {
    baseFolder: './schemas',
    loader: customLoader
  };

  deref(input, options, check(t, expected));
});

test.cb('should work with dots (.) in properties', t => {
  const input = require('./schemas/dotprop.json');
  const expected = require('./schemas/dotprop.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with top level ref properties', t => {
  const input = require('./schemas/toplevel.json');
  const expected = require('./schemas/toplevel.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should error with local circular ref properties', t => {
  const input = require('./schemas/circularlocalref.json');
  // const expected = require('./schemas/circularlocalref.expected.json');

  deref(input, { baseFolder: './schemas' }, (err, schema) => {
    t.truthy(err instanceof Error);
    t.end();
  });
});

test.cb('should error with local self referencing properties', t => {
  const input = require('./schemas/circularself.json');
  // const expected = require('./schemas/circularself.expected.json');

  deref(input, { baseFolder: './schemas' }, (err, schema) => {
    t.truthy(err instanceof Error);
    t.end();
  });
});

test.cb('should error with circular file ref properties', t => {
  const input = require('./schemas/circular-file-root.json');
  // const expected = require('./schemas/circular-file-root.expected.json');

  deref(input, { baseFolder: './schemas' }, (err, schema) => {
    t.truthy(err instanceof Error);
    t.end();
  });
});

test.cb('should work with array refs in file', t => {
  const input = require('./schemas/filerefarray-schema1.json');
  const expected = require('./schemas/filerefarray.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should error with cyclycal object', t => {
  const input = require('./schemas/cyclicaljs.json');

  deref(input, { baseFolder: './schemas' }, (err, schema) => {
    t.truthy(err instanceof Error);
    t.end();
  });
});

test.cb('should work with nested folders object', t => {
  const input = require('./schemas/nestedfolder.json');
  const expected = require('./schemas/nestedfolder.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});

test.cb('should work with nested schema issue 12', t => {
  const input = require('./schemas/issue12.json');
  const expected = require('./schemas/issue12.expected.json');

  deref(input, { baseFolder: './schemas' }, check(t, expected));
});
