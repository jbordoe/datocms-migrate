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
  describe("#diff()", function () {
    it("should return no changes if entities match entirely", function () {
      const env = [
        { id: "123", type: "item", attributes: {name: "foo"}},
        { id: "234", type: "field", attributes: {name: "bar"}},
        { id: "345", type: "fieldset", attributes: {name: "baz"}},
      ];
      const diff = DatoCMSEnvironment.diff(env, env);
      const changes = diff.changes;
      assert.deepEqual(changes, []);
      assert.containSubset(
        diff.meta,
        [
          {
            id: "123",
            type: "item",
            source: {id: "123", type: "item", attributes: {name: "foo"}},
            target: {id: "123", type: "item", attributes: {name: "foo"}},
            current: {name: "foo"},
          },
          {
            id: "234",
            type: "field",
            source: {id: "234", type: "field", attributes: {name: "bar"}},
            target: {id: "234", type: "field", attributes: {name: "bar"}},
            current: {name: "bar"},
          },
          {
            id: "345",
            type: "fieldset",
            source: {id: "345", type: "fieldset", attributes: {name: "baz"}},
            target: {id: "345", type: "fieldset", attributes: {name: "baz"}},
            current: {name: "baz"},
          },
        ]
      );
    });

    it("should return add changes for new entities", function () {
      const envA = [
        { id: "123", type: "item", attributes: {name: "foo"}},
      ];
      const envB = [
        { id: "123", type: "item", attributes: {name: "foo"}},
        { id: "345", type: "fieldset", attributes: {name: "baz"}},
      ];
      const diff = DatoCMSEnvironment.diff(envA, envB);
      const changes = diff.changes;

      assert.equal(changes.length, 1);
      assert.containSubset(
        changes[0],
        {
          action: "add",
          from: undefined,
          to: {name: "baz"},
        }
      );
      assert.containSubset(
        diff.meta,
        [
          {
            id: "123",
            type: "item",
            source: {id: "123", type: "item", attributes: {name: "foo"}},
            target: {id: "123", type: "item", attributes: {name: "foo"}},
            current: {name: "foo"},
          },
          {
            id: "345",
            type: "fieldset",
            source: null, 
            target: {id: "345", type: "fieldset", attributes: {name: "baz"}},
            current: undefined,
          },
        ]
      );
    });

    it("should return del changes for removed entities", function () {
      const envA = [
        { id: "123", type: "item", attributes: {name: "foo"}},
        { id: "345", type: "fieldset", attributes: {name: "baz"}},
      ];
      const envB = [
        { id: "123", type: "item", attributes: {name: "foo"}}
      ];
      const diff = DatoCMSEnvironment.diff(envA, envB);
      const changes = diff.changes;

      assert.equal(changes.length, 1);
      assert.equal(changes[0].action, "del");
    });

    it("should return modRef changes for new entity with references", function () {
      const envA = [];
      const envB = [
        { id: "123", type: "item", attributes: {name: "foo", titleField: "400"}},
      ];
      const diff = DatoCMSEnvironment.diff(envA, envB);
      const changes = diff.changes;

      assert.equal(changes.length, 2);
      assert.deepEqual(["add", "modRefs"], changes.map(({ action }) => action));
      assert.deepEqual(changes[0].to, {name: "foo"});
      assert.deepEqual(changes[1].to, {titleField: "400"});
    });

    it("should return mod changes for updated attributes", function () {
      const envA = [
        { id: "123", type: "item", attributes: {name: "foo"}},
        { id: "345", type: "fieldset", attributes: {name: "baz"}},
      ];
      const envB = [
        { id: "123", type: "item", attributes: {name: "updated"}},
        { id: "345", type: "fieldset", attributes: {name: "baz"}},
      ];
      const diff = DatoCMSEnvironment.diff(envA, envB);
      const changes = diff.changes;

      assert.equal(changes.length, 1);
      assert.deepEqual(["mod"], changes.map(({ action }) => action));
      assert.deepEqual(changes[0].from, {name: "foo"});
      assert.deepEqual(changes[0].to, {name: "updated"});
    });

    it("should return modRefs changes for updated attributes", function () {
      const envA = [
        { id: "123", type: "item", attributes: {titleField: "333"}},
        { id: "345", type: "fieldset", attributes: {name: "baz"}},
      ];
      const envB = [
        { id: "123", type: "item", attributes: {titleField: "999"}},
        { id: "345", type: "fieldset", attributes: {name: "baz"}},
      ];
      const diff = DatoCMSEnvironment.diff(envA, envB);
      const changes = diff.changes;

      assert.equal(changes.length, 1);
      assert.deepEqual(["modRefs"], changes.map(({ action }) => action));
      assert.deepEqual(changes[0].from, {titleField: "333"});
      assert.deepEqual(changes[0].to, {titleField: "999"});
    });

    it("should return mod and modRef when attributes and refs modified", function () {
      const envA = [
        { id: "123", type: "item", attributes: {name: "foo", titleField: "333"}},
        { id: "345", type: "fieldset", attributes: {name: "baz"}},
      ];
      const envB = [
        { id: "123", type: "item", attributes: {name: "bar", titleField: "999"}},
        { id: "345", type: "fieldset", attributes: {name: "baz"}},
      ];
      const diff = DatoCMSEnvironment.diff(envA, envB);
      const changes = diff.changes;

      assert.equal(changes.length, 2);
      assert.deepEqual(["mod", "modRefs"], changes.map(({ action }) => action));
      assert.deepEqual(changes[0].from, {name: "foo"});
      assert.deepEqual(changes[0].to, {name: "bar"});
      assert.deepEqual(changes[1].from, {titleField: "333"});
      assert.deepEqual(changes[1].to, {titleField: "999"});
    });
  });
});
