import DatoCMSEntity from '../src/dato_cms_entity.js';
import assert from 'assert';

describe('DatoCMSEntity', function () {
  describe('#apiKey()', function () {
    it('should return api key when type = item', function () {
      const entity = new DatoCMSEntity('item', {apiKey: 'foo'});
      assert.equal(entity.apiKey, 'foo');
    });
    it('should return api key when type = field', function () {
      const entity = new DatoCMSEntity('field', {apiKey: 'field'}, {apiKey: 'parent'});
      assert.equal(entity.apiKey, 'parent::field');
    });
    it('should return undefined when type = fieldset', function () {
      const entity = new DatoCMSEntity('fieldset', {title: 'foo'});
      assert.equal(entity.apiKey, undefined);
    });
  });
  
  describe('#varName()', function () {
    it('should return variable name when type = item', function () {
      const entity = new DatoCMSEntity('item', {apiKey: 'foo'});
      assert.equal(entity.varName, 'fooItem');
    });
    it('should return variable name when type = field', function () {
      const entity = new DatoCMSEntity('field', {apiKey: 'child'}, {apiKey: 'parent'});
      assert.equal(entity.varName, 'parentChildField');
    });
    it('should return variable name when type = fieldset', function () {
      const entity = new DatoCMSEntity('fieldset', {title: 'child'}, {apiKey: 'parent'});
      assert.equal(entity.varName, 'parentChildFieldset');
    });
  });
});
