import DatoCMSEnvironment from "../src/dato_cms_environment.js";

import DatoCMSEntity from '../src/dato_cms_entity.js';

import os from "os";

import chai from "chai";
import chaiSubset from "chai-subset";
import chaiFiles from "chai-files";

chai.use(chaiSubset);
chai.use(chaiFiles);

const assert = chai.assert;

describe("DatoCMSEnvironment", function () {
  describe("freeze", function() {
    it("should write json to specified location", function () {
      const filename = `${os.tmpdir()}/frozen.json`;

      DatoCMSEnvironment.freeze([{foo: "bar"}, {baz: "qux"}], filename);

      assert.exists(chaiFiles.file(filename));
      chai.expect('[{"foo":"bar"},{"baz":"qux"}]')
        .to.equal(chaiFiles.file(filename));
    });
  });

  describe("thaw", function() {
    it("should read from json and instantiate entities", function () {
      const filename = "./test/fixtures/frozen_env.json";

      const entities = DatoCMSEnvironment.thaw(filename);
     
      assert.equal(entities.length, 6);
      entities.forEach(e => {
        assert.instanceOf(e, DatoCMSEntity);
      });
    });
  });
});
