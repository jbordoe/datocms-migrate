import DatoCMSEntityChange from "../src/entity_change.js";
import assert from "assert";

describe("DatoCMSEntityChange", function () {
  describe("new", function() {
    it("should set 'to' to only non-default values for new item", function () {
      const ec = new DatoCMSEntityChange(
        "add",
        {type: "item"},
        null,
        {apiKey: "hello", tree: false, hint: "foo"},
      );
      assert.deepEqual(ec.to, {apiKey: "hello", hint: "foo"});
    });
    it("should set 'to' to only non-default values for new fieldset", function () {
      const ec = new DatoCMSEntityChange(
        "add",
        {type: "fieldset"},
        null,
        {title: "hello", collapsible: false, hint: "foo"},
      );
      assert.deepEqual(ec.to, {title: "hello", hint: "foo"});
    });
    it("should set 'to' to only non-default values for new field", function () {
      const ec = new DatoCMSEntityChange(
        "add",
        {type: "field"},
        null,
        {apiKey: "hello", fieldset: null, hint: "foo"},
      );
      assert.deepEqual(ec.to, {apiKey: "hello", hint: "foo"});
    });
    
    it("should set 'to' to only changed values for modified entity", function () {
      const ec = new DatoCMSEntityChange(
        "mod",
        {type: "field"},
        {apiKey: "hello", fieldset: null, hint: "foo"},
        {apiKey: "hi", fieldset: null, hint: "foo"},
      );
      assert.deepEqual(ec.to, {apiKey: "hi"});
    });
  });

  describe("#requiredInScope()", function () {
    it("should return empty list for change with no reference fields", function () {
      const ec = new DatoCMSEntityChange(
        "add",
        {},
        {},
        {foo: "bar"}
      );
      assert.deepEqual(ec.requiredInScope, []);
    });
    it("should return ids and paths from reference fields", function () {
      const ec = new DatoCMSEntityChange(
        'add',
        {},
        {},
        {
          "imagePreviewField": "100",
          "validators": {
            "slugTitleField": {
              "titleFieldId": "200"
            },
            "structuredTextLinks": {
              "itemTypes": ["300", "400"],
            }
          }
        }
      );
      assert.deepEqual(
        new Set(ec.requiredInScope),
        new Set(["100", "200", "300", "400"])
      );
    });
  });
});
