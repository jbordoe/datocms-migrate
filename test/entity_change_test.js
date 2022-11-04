import DatoCMSEntityChange from "../src/entity_change.js";
import assert from "assert";

describe("DatoCMSEntityChange", function () {
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
