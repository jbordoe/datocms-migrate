import _ from "lodash"

class DatoCMSEntity {
  constructor(type, attributes, parentItem = undefined) {
    this.type = type;
    this.attributes = attributes;
    this.id = attributes.id;
    this.parentItem = parentItem;
  }

  get varName() {
    var fields;
    switch (this.type) {
      case "item":
        fields = [this.apiKey, this.type];
        break;
      case "field":
        fields = [this.parentItem.apiKey, this.attributes.apiKey, this.type];
        break;
      case "fieldset":
        fields = [this.parentItem.apiKey, this.attributes.title, this.type];
        break;
    }
    return _.camelCase(fields.join("_"));
  }

  get apiKey() {
    if (this.type === "field") {
      return `${this.attributes.apiKey}::${this.parentItem.apiKey}`;
    }
    else {
      return this.attributes.apiKey;
    }
  }
}

export default DatoCMSEntity;
