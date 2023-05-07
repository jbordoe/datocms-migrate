import _ from "lodash";
import DeepDiff from 'deep-diff';
import v8 from 'v8';

const clone = (obj) => v8.deserialize(v8.serialize(obj));

import DatoCMSEntity from '../src/dato_cms_entity.js';

class MetaEntity {
  static OMITTED_ATTRIBIBUTES = [
    'id', 'type', 'meta',
    'fields', 'fieldsets', 'itemType',
    ...DatoCMSEntity.REF_PATHS
  ];


  constructor(type, source, target, current) {
    this.type = type;
    this.source = source;
    this.target = target === undefined ? source : target;
    this.current = clone(
      _.get(
        current === undefined ? source : current,
        'attributes'
      )
    );
    this.id = _.get(source || target, 'id');
  }

  get varName() {
    return (this.source || this.target).varName;
  }

  get apiKey() {
    return (this.source || this.target).apiKey;
  }

  get parent() {
    return _.get((this.source || this.target), "parentItem.meta");
  }

  get label() {
    const entity = this.source || this.target;
    switch(this.type) {
      case "item":
        return entity.attributes.name;
      case "field":
        return entity.attributes.label;
      case "fieldset":
        return entity.attributes.title;
    }
  }

  get idType() {
    return this.type === "fieldset" ? "id" : "apiKey";
  }

  get diff() {
    const source = this.#sourceAttrs() || DatoCMSEntity.DEFAULTS[this.type];
    const target = this.#targetAttrs();
    if (!target) { return undefined }

    var diff = {}
    DeepDiff.observableDiff(source, target, function (d) {
      DeepDiff.applyChange(diff, null, d);
    });
    return _.isEmpty(diff) ? null : diff;
  }

  get refDiff() {
    const source = this.#sourceRefs() || {};
    const target = this.#targetRefs();
    if (!target) { return undefined }

    var diff = {}
    DeepDiff.observableDiff(source, target, function (d) {
      DeepDiff.applyChange(diff, null, d);
    });
    return _.isEmpty(diff) ? null : diff;
  }

  updateState(step) {
    switch(step.action) {
      case "del":
        this.current = undefined;
//        if (this.parent) { this.parent.updatechildren() }
        break;
      case "add":
        //TODO: make test case to ensure later updates don't hang around
        this.current = clone(DatoCMSEntity.DEFAULTS[this.type]);
        _.merge(this.current, step.attrs);
        break;
      case "mod":
      case "modRefs":
        _.merge(this.current, step.attrs);
        break;
      default:
        throw `Unsupported action: {step.action}`
    }
  }

  changes(newAttrs) {
    var diff = {}
    DeepDiff.observableDiff(
      this.current,
      _.merge(clone(this.current), newAttrs),
      function (d) {
        DeepDiff.applyChange(diff, null, d);
      });
    return _.isEmpty(diff) ? null : diff;
  }

  #sourceAttrs() {
    return MetaEntity.#attrs({attributes: this.current});
  }
  #targetAttrs() {
    return MetaEntity.#attrs(this.target);
  }
  #sourceRefs() {
    return MetaEntity.#refs({attributes: this.current});
  }
  #targetRefs() {
    return MetaEntity.#refs(this.target);
  }

  static #attrs(entity) {
    // _(entity).get(foo, {})
    const attrs = _(_.get(entity, 'attributes', {}))
      .omit(this.OMITTED_ATTRIBIBUTES)
      .value();
    return !_.isEmpty(attrs) ? clone(attrs) : undefined;
  }

  static #refs(entity) {
    const attrs = _(_.get(entity, 'attributes', {}))
      .pick(DatoCMSEntity.REF_PATHS)
      .value();
    return !_.isEmpty(attrs) ? clone(attrs) : undefined;
  }
}

export default MetaEntity;
