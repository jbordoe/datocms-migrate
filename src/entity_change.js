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
    'excerptField',
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
    this.type = entity.type;
    this.entity = entity;
    this.from = from;
    this.to = to;
    this.requiredInScope = this.#requiredInScope();
  }

  get refPaths() {
    return DatoCMSEntityChange.REF_PATHS
      .filter((path) => _.get(this.to, path));
  }

  get varName() {
    return this.entity.varName;
  }
  
  #requiredInScope() {
    const refdIds = [
      // TODO: we can use API key of parent for all operations. Update
      // codegen so we use api_key string instead od ID lookup
      // n.b. still need vars in scope to get ids for ref fields like 'itemTypes'
//      _.get(this.entity, 'parent.id'),
      DatoCMSEntityChange.REF_PATHS.map((path) => _.get(this.to, path, []))
    ];
    return _.flattenDeep(refdIds).filter((id) => id);
  }

}

export { DatoCMSEntityChange };
export default DatoCMSEntityChange;
