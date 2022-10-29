import _ from "lodash";
import v8 from 'v8';

const structuredClone = (obj) => v8.deserialize(v8.serialize(obj));

class MetaEntity {
  constructor(type, source, target, current) {
    this.type = type;
    this.source = source;
    this.target = target;
    this.current = structuredClone(_.get(current, 'attributes'));
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
        return entity.attributes.name
      case "field":
        return entity.attributes.label
      case "fieldset":
        return entity.attributes.title
    }
  }

  updateState(change) {
    switch(change.action) {
      case "del":
        this.current = undefined;
        break;
      case "add":
        this.current = change.to;
        break;
      case "mod":
      case "modRefs":
        _.merge(this.current, change.to);
        break;
      default:
        throw `Unsupported action: {change.action}`
    }
  }
}

export default MetaEntity;
