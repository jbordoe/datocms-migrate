import ChangeManager from "../src/change_manager.js";

import MetaEntity from "../src/meta_entity.js";

import chai from "chai";
import chaiSubset from "chai-subset";
chai.use(chaiSubset);
const assert = chai.assert;

describe("ChangeManager", function () {
  describe("#generateSteps()", function () {
    it("should return add steps for item add changes", function () {
      const entities = [
        new MetaEntity(
          "item",
          undefined,
          {id: "123", attributes: {foo: "bar"}}
        ),
        new MetaEntity(
          "item",
          undefined,
          {id: "234", attributes: {foo: "baz"}}
        ),
      ];

      const manager = new ChangeManager();
      assert.containSubset(
        manager.generateSteps(entities),
        [
          {action: "add", type: "item", attrs: {foo: "bar"}, scope: false},
          {action: "add", type: "item", attrs: {foo: "baz"}, scope: false},
        ]
      );
    });

    it("should sort steps by type and action", function () {
      const entities = [
        new MetaEntity(
          "item",
          undefined,
          {id: "100", attributes: {name: "A1"}}
        ),
        new MetaEntity(
          "item",
          {id: "101", attributes: {name: "D1"}},
          undefined
        ),
        new MetaEntity(
          "field",
          undefined,
          {id: "200", attributes: {name: "A2"}}
        ),
        new MetaEntity(
          "field",
          {id: "201", attributes: {name: "D2"}}
        ),
        new MetaEntity(
          "fieldset",
          {id: "300", attributes: {name: "A3"}}
        ),
        new MetaEntity(
          "fieldset",
          {id: "301", attributes: {}}
        ),
      ];
      const changes = [
        new Change("add", entities[0], {}, {foo: "bar"}),
        new Change("add", entities[2], {}, {foo: "bar"}),
        new Change("del", entities[5], {}, {foo: "bar"}),
        new Change("mod", entities[4], {}, {foo: "bar"}),
        new Change("add", entities[4], {}, {foo: "bar"}),
        new Change("del", entities[1], {}, {foo: "bar"}),
        new Change("mod", entities[2], {}, {foo: "bar"}),
        new Change("mod", entities[0], {}, {foo: "bar"}),
        new Change("del", entities[3], {}, {foo: "bar"}),
        new Change("modRefs", entities[0], {}, {foo: "bar"}),
        new Change("modRefs", entities[2], {}, {foo: "bar"}),
      ];

      const manager = new ChangeManager();
      const steps = manager.generateSteps(entities);
      assert.deepEqual(
        steps.map(({action, type}) => ({action: action, type: type})),
        [
          {action: "del", type: "item"},
          {action: "mod", type: "item"},
          {action: "add", type: "item"},
          {action: "del", type: "fieldset"},
          {action: "mod", type: "fieldset"},
          {action: "add", type: "fieldset"},
          {action: "del", type: "field"},
          {action: "mod", type: "field"},
          {action: "add", type: "field"},
          {action: "modRefs", type: "item"},
          {action: "modRefs", type: "field"},
        ]
      );
    });

    it("should add scope flag to item add iff item referenced later", function () {
      const entities = [
        new MetaEntity("item", undefined, {id: "123"}, undefined),
        new MetaEntity("item", undefined, {id: "456"}, undefined),
        new MetaEntity("field", undefined, {id: "99"}, undefined),
      ];
      const changes = [
        new Change("add", entities[0], {}, {foo: "bar"}),
        new Change("add", entities[1], {}, {foo: "baz"}),
        new Change(
          "modRefs",
          entities[2],
          {},
          {
            validators: {
              itemItemType: {itemTypes: ["123"]}
            }
          },
        )
      ];

      const manager = new ChangeManager();
      assert.containSubset(
        manager.generateSteps(changes, entities),
        [
          {action: "add", type: "item", attrs: {foo: "bar"}, scope: true},
          {action: "add", type: "item", attrs: {foo: "baz"}, scope: false},
          {action: "modRefs", type: "field", scope: false},
        ]
      );
    });

    it("should add refernced item scope step just once", function () {
      const item1 = new MetaEntity("item", {id: "101", apiKey: "posta"});
      const item2 = new MetaEntity("item", {id: "102", apiKey: "postb"});
      const field1 = new MetaEntity("field", {id: "200", apiKey: "sluga"});
      const field2 = new MetaEntity("field", {id: "201", apiKey: "slugb"});

      const changes = [
        new Change(
          "modRefs",
          field1,
          {},
          {
            validators: {
              itemItemType: {itemTypes: [item1.id, item2.id]}
            }
          },
        ),
        new Change(
          "modRefs",
          field2,
          {},
          {
            validators: {
              itemItemType: {itemTypes: [item1.id]}
            }
          },
        )
      ];

      const manager = new ChangeManager();
      const steps = manager.generateSteps(changes, [item1, item2, field1, field2]);
      assert.containSubset(steps, [
        {action: "scope", id: "posta", type: "item", scope: true},
        {action: "scope", id: "postb", type: "item", scope: true},
        {action: "modRefs", type: "field", scope: false},
        {action: "modRefs", type: "field", scope: false},
      ]);
    });

    it("should add scope step before step requiring a reference", function () {
      const entities = [
        new MetaEntity("field", undefined, {id: "123"}, undefined),
        new MetaEntity("fieldset", undefined, {id: "999"}, undefined),
      ];
      const changes = [
        new Change(
          "modRefs",
          entities[0],
          {},
          {fieldset: "999"},
        )
      ];

      const manager = new ChangeManager();
      assert.containSubset(
        manager.generateSteps(changes, entities),
        [
          {action: "scope", type: "fieldset", scope: true},
          {action: "modRefs", type: "field", scope: false},
        ]
      );
    });

    it("should add scope step before step requiring a reference", function () {
      const entities = [
        new MetaEntity("field", undefined, {id: "123"}, undefined),
        new MetaEntity("fieldset", undefined, {id: "999"}, undefined),
      ];
      const changes = [
        new Change(
          "modRefs",
          entities[0],
          {},
          {fieldset: "999"},
        ),
        new Change(
          "modRefs",
          entities[0],
          {},
          {fieldset: "999"},
        ),
      ];

      const manager = new ChangeManager();
      const steps = manager.generateSteps(changes, entities);
      assert.containSubset(steps, [
        {action: "scope", type: "fieldset", scope: true},
        {action: "modRefs", type: "field", scope: false},
        {action: "modRefs", type: "field", scope: false},
      ]);
    });

    it("should not add scope step if action already scoped", function () {
      const entities = [
        new MetaEntity("field", undefined, {id: "123"}, undefined),
        new MetaEntity("fieldset", undefined, {id: "999"}, undefined),
      ];
      const changes = [
        new Change("add", entities[1], {}, {id: "999"}),
        new Change("modRefs", entities[0], {}, {fieldset: "999"}),
      ];

      const manager = new ChangeManager();
      assert.containSubset(
        manager.generateSteps(changes, entities),
        [
          {action: "add", type: "fieldset", scope: true},
          {action: "modRefs", type: "field", scope: false},
        ]
      );
    });

    it("should not add redundant delete steps when parent item is deleted", function () {
      const item = new MetaEntity(
        "item",
        {id: "100", apiKey: "post"},
        undefined,
        {id: "100", attributes: {foo: "bar"}}
      );
      const fieldset = new MetaEntity(
        "fieldset",
        {id: "200", parentItem: {meta: item}},
        undefined,
        {id: "200", attributes: {foo: "bar"}}
      );
      const field = new MetaEntity(
        "field",
        {id: "300", parentItem: {meta: item}},
        undefined,
        {id: "300", attributes: {foo: "bar"}}
      );

      const changes = [
        new Change("del", item, {id: "100"}, {}),
        new Change("del", fieldset, {id: "200"}, {}),
        new Change("del", field, {id: "300"}, {}),
      ];

      const manager = new ChangeManager();
      const steps = manager.generateSteps(changes, [item, fieldset, field]);

      assert.equal(steps.length, 1);
      assert.containSubset(
        steps[0],
        {action: "del", type: "item", idType: "apiKey", id: "post", scope: false}
      );
    });

    it("should ensure slugs are created after the field they reference", function () {
      const item = new MetaEntity(
        "item",
        {id: "100", apiKey: "post"},
        {id: "100", apiKey: "post"},
        {apiKey: "post"},
      );
      const titleField = new MetaEntity(
        "field",
        undefined,
        {id: "200", attributes: { label: "Title", fieldType: "text" }},
        undefined,
      );
      const slugField = new MetaEntity(
        "field",
        undefined,
        {
          id: "200",
          attributes: {
            label: "Slug",
            fieldType: "slug",
            validators: {slugTitleField: {titleFieldId: titleField.id}},
          }
        },
        undefined,
      );

      const changes = [
        new Change(
          "add",
          slugField,
          undefined,
          slugField.target.attributes
        ),
        new Change(
          "add",
          titleField,
          undefined,
          titleField.target.attributes
        ),
      ];

      const manager = new ChangeManager();
      const steps = manager.generateSteps(changes, [item, slugField, titleField]);

      assert.containSubset(
        steps,
        [
          {action: "add", type: "field", attrs: {label: "Title"}, scope: true},
          {action: "add", type: "field", attrs: {label: "Slug"}, scope: false},
        ]
      );
      assert.equal(steps.length, 2);
    });

    it("should order steps so as to prevent invalid state", function () {
      const entities = [
        new MetaEntity("field", undefined, {id: "100"}, {apiKey: "bar"}),
        new MetaEntity("field", undefined, {id: "200"}, {apiKey: "foo"}),
      ];
      const changes = [
        new Change(
          "mod",
          entities[0],
          {},
          {apiKey: "foo"},
        ),
        new Change(
          "mod",
          entities[1],
          {},
          {apiKey: "baz"},
        ),
      ];

      const manager = new ChangeManager();
      assert.containSubset(
        manager.generateSteps(changes, []),
        [
          {action: "mod", type: "field", attrs: {apiKey: "baz"}},
          {action: "mod", type: "field", attrs: {apiKey: "foo"}},
        ]
      );
    });

    it("should add vars and paths of referenced data to modRef step", function () {
      const entities = [
        new MetaEntity("field", undefined, {id: "123"}, undefined),
        new MetaEntity("fieldset", undefined, {id: "999", varName: "foo"}, undefined),
      ];
      const changes = [
        new Change(
          "modRefs",
          entities[0],
          {},
          {fieldset: "999"},
        )
      ];

      const manager = new ChangeManager();
      assert.containSubset(
        manager.generateSteps(changes, entities),
        [
          {action: "scope", type: "fieldset", scope: true},
          {
            action: "modRefs",
            type: "field",
            scope: false,
            refVars: {"fieldset": "foo"},
          },
        ]
      );
    });

    it("creates a temporary mod step to enable swaps of unique attributes", function () {
      this.skip();
      const entities = [
        new MetaEntity("field", undefined, {id: "100"}, {apiKey: "foo"}),
        new MetaEntity("field", undefined, {id: "200"}, {apiKey: "bar"}),
      ];
      const changes = [
        new Change(
          "mod",
          entities[0],
          {},
          {apiKey: "bar"},
        ),
        new Change(
          "mod",
          entities[1],
          {},
          {apiKey: "foo"},
        ),
      ];

      const manager = new ChangeManager();
      assert.containSubset(
        manager.generateSteps(changes, []),
        [
          {action: "mod", type: "field", attrs: {apiKey: "foo"}},
          {action: "mod", type: "field", attrs: {apiKey: "blah"}},
          {action: "mod", type: "field", attrs: {apiKey: "bar"}},
        ]
      );
    });
  });
});
