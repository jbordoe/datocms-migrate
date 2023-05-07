import DatoCMSEnvironment from "../src/dato_cms_environment.js";

import DatoCMSEntity from '../src/dato_cms_entity.js';
import MetaEntity from '../src/meta_entity.js';

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
    it("should read from json and instantiate meta-entities", function () {
      const filename = "./test/fixtures/frozen_env.json";

      const entities = DatoCMSEnvironment.thaw(filename);
     
      assert.equal(entities.length, 6);
      entities.forEach(e => {
        assert.instanceOf(e, DatoCMSEntity);
      });
    });
  });

  describe("#diff()", function () {
    it("should return meta-entities", function () {
      const envA = [
        { id: "123", type: "item", attributes: {name: "foo"}},
      ];
      const envB = [
        { id: "456", type: "item", attributes: {name: "baz"}},
      ];
      const entities = DatoCMSEnvironment.diff(envA, envB);
      entities.forEach(e => {
        assert.instanceOf(e, MetaEntity);
      });
    });
  });
});
