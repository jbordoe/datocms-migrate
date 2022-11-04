import _ from "lodash"
import DeepDiff from 'deep-diff';

import DatoCMSEntity from '../src/dato_cms_entity.js';

class DatoCMSEntityChange {
  // TODO: use static/class vars
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
    ...DatoCMSEntityChange.ITEM_REF_PATHS,
    ...DatoCMSEntityChange.FIELD_REF_PATHS,
    ...DatoCMSEntityChange.FIELDSET_REF_PATHS
  ];

  constructor(action, entity, from, to) {
    this.action = action
    this.type = entity.type;
    // TODO: let's rename this meta
    this.entity = entity;
    this.from = from;
    this.to = this.#diff(from, to);
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
    return _(refdIds).flattenDeep().uniq().filter((id) => id).value();
  }

  #diff(source, target) {
    if (!target) { return undefined }
    var diff = {}
    source ||= DatoCMSEntity.DEFAULTS[this.type],
    DeepDiff.observableDiff(source, target, function (d) {
      DeepDiff.applyChange(diff, null, d);
    });
    return diff;
  }
}

export { DatoCMSEntityChange };
export default DatoCMSEntityChange;
