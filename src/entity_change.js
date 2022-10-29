import _ from "lodash"

class DatoCMSEntityChange {
  // TODO: use static/class vars
  static ITEM_REF_PATHS = [
    // Link fields
    'validators.itemItemType.itemTypes',
    // Modular Content Fields
    'validators.richTextBlocks.itemTypes',
    // Structured Text Fields
    'validators.structuredTextBlocks.itemTypes',
    'validators.structuredTextLinks.itemTypes',
  ];
  static FIELD_REF_PATHS = [
    // Modules & Blocks
    'imagePreviewField',
    'exceprtField',
    'orderingFTeld',
    'titleField',
    // Slug Field
    'validators.slugTitleField.titleFieldId',
  ];
  static FIELDSET_REF_PATHS = ['fieldset'];
  static REF_PATHS = [
    ...DatoCMSEntityChange.ITEM_REF_PATHS,
    ...DatoCMSEntityChange.FIELD_REF_PATHS,
    ...DatoCMSEntityChange.FIELDSET_REF_PATHS
  ];

  constructor(action, entity, from, to) {
    this.action = action
    // TODO: let's rename this meta
    this.entity = entity;
    this.from = from;
    this.to = to;
  }

  get requiredInScope() {
    const refdIds = [
      _.get(this.entity, 'parent.id'),
      DatoCMSEntityChange.REF_PATHS.map((path) => _.get(this.to, 'attributes.' + path, []))
    ];
    return _.flattenDeep(refdIds).filter((id) => id);
  }

  get refPaths() {
    return DatoCMSEntityChange.REF_PATHS
      .filter((path) => _.get(this.to, 'attributes.' + path));
  }

  get varName() {
    return this.entity.varName;
  }

  get type() {
    return this.entity.type;
  }
}

export default DatoCMSEntityChange;
