import MetaEntity from '../src/meta_entity.js';

import chai from "chai";
import chaiSubset from "chai-subset";
chai.use(chaiSubset);
const assert = chai.assert;

describe('MetaEntity', function () {
  describe('new', function() {
    it('should accept type, source, target and current', function () {
      const meta = new MetaEntity(
        'item',
        {attributes: {apiKey: 'foo'}},
        {attributes: {apiKey: 'bar'}},
        {attributes: {apiKey: 'foo'}},
      );
      assert.instanceOf(meta, MetaEntity);
      assert.deepEqual(meta.source, {attributes: {apiKey: 'foo'}});
      assert.deepEqual(meta.target, {attributes: {apiKey: 'bar'}});
      assert.deepEqual(meta.current, {apiKey: 'foo'});
    });

    it('should set current to source attributes only when undefined', function () {
      const meta = new MetaEntity(
        'item',
        {attributes: {apiKey: 'foo'}},
        {attributes: {apiKey: 'bar'}},
      );
      assert.instanceOf(meta, MetaEntity);
      assert.deepEqual(meta.current, {apiKey: 'foo'});

      const meta2 = new MetaEntity(
        'item',
        {attributes: {apiKey: 'foo'}},
        {attributes: {apiKey: 'bar'}},
        null
      );
      assert.instanceOf(meta2, MetaEntity);
      assert.equal(meta2.current, null);
    });

    it('should set target to source only when undefined', function () {
      const meta = new MetaEntity(
        'item',
        {attributes: {apiKey: 'foo'}},
      );

      const meta2 = new MetaEntity(
        'item',
        {attributes: {apiKey: 'foo'}},
        null
      );
      assert.instanceOf(meta, MetaEntity);
      assert.deepEqual(meta.target, meta.source);
      assert.deepEqual(meta.current, {apiKey: 'foo'});

      assert.instanceOf(meta2, MetaEntity);
      assert.equal(meta2.target, null);
      assert.deepEqual(meta2.current, {apiKey: 'foo'});
    });

    it('should use id from source if present', function () {
      const meta = new MetaEntity('item', {id: "9999"}, {id: "0001"});
      assert.equal(meta.id, "9999");
    });

    it('should use id from target if no source', function () {
      const meta = new MetaEntity('item', null, {id: "0001"});
      assert.equal(meta.id, "0001");
    });

  });

  describe('#apiKey()', function () {
    it('should return api key from source when present', function () {
      const entity = new MetaEntity('item', {apiKey: 'foo'});
      assert.equal(entity.apiKey, 'foo');
    });
    it('should return api key from target when no source', function () {
      const entity = new MetaEntity('item', undefined, {apiKey: 'foo'});
      assert.equal(entity.apiKey, 'foo');
    });
  });

  describe('#label()', function () {
    it('should return item name from source when present', function () {
      const entity = new MetaEntity(
        'item',
        {attributes: {name: 'foo'}},
        undefined,
        undefined,
      );
      assert.equal(entity.label, 'foo');
    });

    it('should return item name from target when present', function () {
      const entity = new MetaEntity(
        'item',
        undefined,
        {attributes: {name: 'foo'}},
        undefined,
      );
      assert.equal(entity.label, 'foo');
    });

    it('should return field label from source when present', function () {
      const entity = new MetaEntity(
        'field',
        {attributes: {label: 'foo'}},
        undefined,
        undefined
      );
      assert.equal(entity.label, 'foo');
    });

    it('should return field label from target when present', function () {
      const entity = new MetaEntity(
        'field',
        undefined,
        {attributes: {label: 'foo'}},
        undefined,
      );
      assert.equal(entity.label, 'foo');
    });

    it('should return fieldset title from source when present', function () {
      const entity = new MetaEntity(
        'fieldset',
        {attributes: {title: 'foo'}},
        undefined,
        undefined,
      );
      assert.equal(entity.label, 'foo');
    });

    it('should return fieldset title from target when present', function () {
      const entity = new MetaEntity(
        'fieldset',
        undefined,
        {attributes: {title: 'foo'}},
        undefined,
      );
      assert.equal(entity.label, 'foo');
    });
  });

  describe('#varName()', function () {
    it('should return variable name from source when present', function () {
      const entity = new MetaEntity('item', {varName: 'foo'}, undefined, undefined);
      assert.equal(entity.varName, 'foo');
    });
    it('should return variable name from target when no source', function () {
      const entity = new MetaEntity('item', undefined, {varName: 'foo'}, undefined);
      assert.equal(entity.varName, 'foo');
    });
  });

  describe('#parent()', function () {
    it('should return parent meta from source when present', function () {
      const entity = new MetaEntity(
        'item',
        {varName: 'foo', parentItem: {meta: "parentA"}},
        undefined,
        undefined
      );
      assert.equal(entity.parent, 'parentA');
    });
    it('should return parent meta name from target when no source', function () {
      const entity = new MetaEntity(
        'item',
        undefined,
        {varName: 'foo', parentItem: {meta: "parentB"}},
        undefined
      );
      assert.equal(entity.parent, 'parentB');
    });
  });

  describe('#updateState()', function () {
    it('should wipe state with del function', function () {
      const entity = new MetaEntity(
        'item',
        {varName: 'foo'},
        undefined,
        {attributes: {foo: "bar"}}
      );
      assert.deepEqual(entity.current, {foo: "bar"});

      entity.updateState({action: "del"})
      assert.equal(entity.current, undefined);
    });

    it('should create state with defaults and attrs from add function', function () {
      const entity = new MetaEntity(
        'item',
        {varName: 'foo'},
        undefined,
        undefined
      );
      assert.equal(entity.current, undefined);

      entity.updateState({action: "add", to: {foo: "bar"}})
      assert.deepEqual(entity.current, {foo: "bar"});
    });

    it('should merge state with attrs from mod function', function () {
      const entity = new MetaEntity(
        'item',
        {varName: 'foo'},
        undefined,
        {attributes: {foo: "bar", hello: "world"}}
      );
      assert.deepEqual(entity.current, {foo: "bar", hello: "world"});

      entity.updateState({
        action: "mod",
        to: {foo: 123, hallo: "welt", a: {b: "c"}},
      })
      assert.deepEqual(
        entity.current,
        {foo: 123, hello: "world", hallo: "welt", a: {b: "c"}}
      );
    });

    it('should merge state with attrs from modRefs function', function () {
      const entity = new MetaEntity(
        'item',
        {varName: 'foo'},
        undefined,
        {attributes: {foo: "bar", hello: "world"}}
      );
      assert.deepEqual(entity.current, {foo: "bar", hello: "world"});

      entity.updateState({
        action: "modRefs",
        to: {foo: 123, hallo: "welt", a: {b: "c"}},
      })
      assert.deepEqual(
        entity.current,
        {foo: 123, hello: "world", hallo: "welt", a: {b: "c"}}
      );
    });
  });
});
