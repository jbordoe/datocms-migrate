import envDiff from "../src/env_diff.js";
import assert from "assert";

describe("#envDiff()", function () {
  it("should return no changes if entities match entirely", function () {
    const env = [
      { id: "123", type: "item", attributes: {name: "foo"}},
      { id: "234", type: "field", attributes: {name: "bar"}},
      { id: "345", type: "fieldset", attributes: {name: "baz"}},
    ];
    const diff = envDiff(env, env);
    const changes = diff.changes;
    assert.deepEqual(changes, []);
  });
  
  it("should return add changes for new entities", function () {
    const envA = [
      { id: "123", type: "item", attributes: {name: "foo"}},
    ];
    const envB = [
      { id: "123", type: "item", attributes: {name: "foo"}},
      { id: "345", type: "fieldset", attributes: {name: "baz"}},
    ];
    const diff = envDiff(envA, envB);
    const changes = diff.changes;

    assert.equal(changes.length, 1);
    assert.equal(changes[0].action, "add");
    assert.deepEqual(changes[0].to, {name: "baz"});
  });
  
  it("should return del changes for new entities", function () {
    const envA = [
      { id: "123", type: "item", attributes: {name: "foo"}},
      { id: "345", type: "fieldset", attributes: {name: "baz"}},
    ];
    const envB = [
      { id: "123", type: "item", attributes: {name: "foo"}}
    ];
    const diff = envDiff(envA, envB);
    const changes = diff.changes;

    assert.equal(changes.length, 1);
    assert.equal(changes[0].action, "del");
  });

  it("should return modRef changes for new entity with references", function () {
    const envA = [];
    const envB = [
      { id: "123", type: "item", attributes: {name: "foo", titleField: "400"}},
    ];
    const diff = envDiff(envA, envB);
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
    const diff = envDiff(envA, envB);
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
    const diff = envDiff(envA, envB);
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
    const diff = envDiff(envA, envB);
    const changes = diff.changes;

    assert.equal(changes.length, 2);
    assert.deepEqual(["mod", "modRefs"], changes.map(({ action }) => action));
    assert.deepEqual(changes[0].from, {name: "foo"});
    assert.deepEqual(changes[0].to, {name: "bar"});
    assert.deepEqual(changes[1].from, {titleField: "333"});
    assert.deepEqual(changes[1].to, {titleField: "999"});
  });
});
