import CodeGenerator from "../src/code_generator.js";

import chai from "chai";
import chaiSubset from "chai-subset";
chai.use(chaiSubset);
const assert = chai.assert;

describe("CodeGenerator", function () {
  describe("#generate()", function () {
    it("should return create for item add", function () {
      const steps = [{action: 'add', type: 'item', attrs: {foo: 'bar'}}];
      const codegen = new CodeGenerator();
      assert.include(
        codegen.generate(steps),
        "await client.itemTypes.create({ foo: 'bar' });"
      );
    });

    it("should return update for item mod", function () {
      const steps = [{
        action: 'mod',
        type: 'item',
        attrs: {foo: 'bar'},
        id: 'my_block',
      }];
      const codegen = new CodeGenerator();
      assert.include(
        codegen.generate(steps),
        "await client.itemTypes.update('my_block', { foo: 'bar' });"
      );
    });

    it("should return destroy for item del", function () {
      const steps = [{action: 'del', type: 'item', id: 'my_block'}];
      const codegen = new CodeGenerator();
      assert.include(
        codegen.generate(steps),
        "await client.itemTypes.destroy('my_block');"
      );
    });

    it("should return create with parent apiKey for fieldset add", function () {
      const steps = [{
        action: 'add',
        type: 'fieldset',
        attrs: {foo: 'bar'},
        parentKey: 'my_block',
      }];
      const codegen = new CodeGenerator();
      assert.include(
        codegen.generate(steps),
        "await client.fieldset.create('my_block', { foo: 'bar' });"
      );
    });

    it("should return update for fieldset mod", function () {
      const steps = [{
        action: 'mod',
        type: 'fieldset',
        attrs: {foo: 'bar'},
        id: '12345',
      }];
      const codegen = new CodeGenerator();
      assert.include(
        codegen.generate(steps),
        "await client.fieldset.update('12345', { foo: 'bar' });"
      );
    });

    it("should return destroy for fieldset del", function () {
      const steps = [{action: 'del', type: 'fieldset', id: '12345'}];
      const codegen = new CodeGenerator();
      assert.include(
        codegen.generate(steps),
        "await client.fieldset.destroy('12345');"
      );
    });

    it("should return create with parent apiKey for field add", function () {
      const steps = [{
        action: 'add',
        type: 'field',
        attrs: {foo: 'bar'},
        parentKey: 'my_block',
      }];
      const codegen = new CodeGenerator();
      const code = codegen.generate(steps);
      assert.include(
        code,
        "await client.field.create('my_block', { foo: 'bar' });"
      );
    });

    it("should return update for field mod", function () {
      const steps = [{
        action: 'mod',
        type: 'field',
        attrs: {foo: 'bar'},
        id: '12345',
      }];
      const codegen = new CodeGenerator();
      assert.include(
        codegen.generate(steps),
        "await client.field.update('12345', { foo: 'bar' });"
      );
    });

    it("should return update with referenced vars for field modRefs", function () {
      const steps = [{
        action: 'modRefs',
        type: 'field',
        attrs: {foo: 'bar', fieldset: '999'},
        refVars: {'fieldset': 'myFs'},
        id: '12345',
      }];
      const codegen = new CodeGenerator();
      const code = codegen.generate(steps).split("\n");

      assert.include(
        code,
        "await client.field.update('12345', { foo: 'bar', fieldset: myFs.id });"
      );
    });

    it("should return update with referenced fieldset for field add", function () {
      const steps = [{
        action: 'add',
        type: 'field',
        attrs: {foo: 'bar', fieldset: '999'},
        refVars: {'fieldset': 'myFs'},
        parentKey: 'foo',
      }];
      const codegen = new CodeGenerator();
      const code = codegen.generate(steps).split("\n");

      assert.include(
        code,
        "await client.field.create('foo', { foo: 'bar', fieldset: myFs.id });"
      );
    });

    it("should return destroy for field del", function () {
      const steps = [{action: 'del', type: 'field', id: '12345'}];
      const codegen = new CodeGenerator();
      assert.include(
        codegen.generate(steps),
        "await client.field.destroy('12345');"
      );
    });

    it("should assign to variable for add,mod with scope flag", function () {
      const steps = [
        {
          action: 'add',
          type: 'item',
          attrs: {name: 'cat'},
          scope: true,
          varName: 'v1',
          id: 'catBlock'
        },
        {
          action: 'add',
          type: 'item',
          attrs: {name: 'dog'},
          scope: false,
          varName: 'v2',
          id: 'dogBlock'
        },
        {
          action: 'mod',
          type: 'item',
          attrs: {name: 'rat'},
          scope: true,
          varName: 'v3',
          id: 'ratBlock'
        },
        {
          action: 'mod',
          type: 'item',
          attrs: {name: 'hog'},
          scope: false,
          varName: 'v4',
          id: 'hogBlock',
        },
        {
          action: 'del',
          type: 'item',
          scope: true,
          varName: 'v5',
          id: 'batBlock'
        },
      ];
      const codegen = new CodeGenerator();
      const code = codegen.generate(steps).split("\n");

      assert.include(code, "const v1 = await client.itemTypes.create({ name: 'cat' });");
      assert.include(code, "await client.itemTypes.create({ name: 'dog' });");
      assert.include(code, "const v3 = await client.itemTypes.update('ratBlock', { name: 'rat' });");
      assert.include(code, "await client.itemTypes.update('hogBlock', { name: 'hog' });");
      assert.include(code, "await client.itemTypes.destroy('batBlock');");
    });

    it("should find with id and assign to var for scope steps", function () {
      const steps = [
        {action: 'scope', type: 'item', id: 'cat', varName: 'catBlock'},
        {action: 'scope', type: 'field', id: 'dog', varName: 'dogField'},
        {action: 'scope', type: 'fieldset', id: 'rat', varName: 'ratFieldset'},
      ];
      const codegen = new CodeGenerator();
      const code = codegen.generate(steps).split("\n");

      assert.include(code, "const catBlock = await client.itemTypes.find('cat');");
      assert.include(code, "const dogField = await client.field.find('dog');");
      assert.include(code, "const ratFieldset = await client.fieldset.find('rat');");
    });

  });
});
