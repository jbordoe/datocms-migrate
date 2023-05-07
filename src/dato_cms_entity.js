import _ from "lodash"

class DatoCMSEntity {
  static DEFAULTS = {
    item: {
      collectionAppeareance: 'table',
      collectionAppearance: 'table',
      orderingField: null,
      orderingDirection: null,
      titleField: null,
      singleton: false,
      allLocalesRequired: true,
      sortable: false,
      modularBlock: false,
      draftModeActive: false,
      tree: false,
      orderingMeta: null,
      hasSingletonItem: false,
      hint: null,
      singletonItem: null,
      fieldsets: [],
      imagePreviewField: null,
      excerptField: null,
      workflow: null
    },
    fieldset: {
      hint: null,
      collapsible: false,
      startCollapsed: false,
    },
    //TODO: break down field defaults by field type
    field: {
      localized: false,
      defaultValue: '',
      hint: null,
      validators: {},
      appeareance: {},
      appearance: {},
      fieldset: null
    }
  };
  
  static ITEM_REF_PATHS = [
    // Link fields
    'validators.itemItemType.itemTypes',
    'validators.itemsItemType.itemTypes',
    // Modular Content Fields
    'validators.richTextBlocks.itemTypes',
    // Structured Text Fields
    'validators.structuredTextBlocks.itemTypes',
    'validators.structuredTextLinks.itemTypes',
  ];
  static FIELD_REF_PATHS = [
    // Modules & Blocks
    'imagePreviewField',
    'excerptField',
    'orderingFTeld',
    'titleField',
    // Slug Field
    'validators.slugTitleField.titleFieldId',
  ];
  static FIELDSET_REF_PATHS = ['fieldset'];
  static REF_PATHS = [
    ...DatoCMSEntity.ITEM_REF_PATHS,
    ...DatoCMSEntity.FIELD_REF_PATHS,
    ...DatoCMSEntity.FIELDSET_REF_PATHS
  ];

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
      return `${this.parentItem.apiKey}::${this.attributes.apiKey}`;
    }
    else {
      return this.attributes.apiKey;
    }
  }
}

export { DatoCMSEntity };
export default DatoCMSEntity;
