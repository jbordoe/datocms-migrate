import DatoCMSEntityChange from "../src/entity_change.js";
import assert from "assert";

describe("DatoCMSEntityChange", function () {
  describe("#getRequiredInScope()", function () {
    it("should return ids from reference fields", function () {
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
    it("should include parent item id if present", function () {
      const ec = new DatoCMSEntityChange(
        'add',
        {parent: {id: "123"}},
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
        new Set(["100", "200", "300", "400", "123"])
      );
    });
  });
  
});
