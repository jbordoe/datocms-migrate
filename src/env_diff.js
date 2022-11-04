import _ from "lodash"
import util from "util";
import v8 from 'v8';

const structuredClone = (obj) => v8.deserialize(v8.serialize(obj));

import DatoCMSEntityChange from "../src/entity_change.js";
import MetaEntity from "../src/meta_entity.js";

function envDiff(oldEntities, newEntities) {
  const oldIds = _.keyBy(oldEntities, 'id');
  const newIds = _.keyBy(newEntities, 'id');

  const metaEntities = _([...oldEntities, ...newEntities])
    .uniqBy('id')
    .map(({ id, type }) => {
      const oldE = oldIds[id] || null;
      const newE = newIds[id] || null;
      const meta = new MetaEntity(type, oldE, newE, oldE);
      if (oldE) { oldE.meta = meta }
      if (newE) { newE.meta = meta }
      return meta;
    })
    .value();

  const changes = metaEntities.map((meta) => {
    const [oldE, newE] = [meta.source, meta.target];
    const [oldAttrs, newAttrs] = [pickAttrs(oldE), pickAttrs(newE)];
    const [oldRefs, newRefs]   = [pickRefs(oldE), pickRefs(newE)];

    var changes = [];
    if (newE && !oldE) {
      if (newAttrs) {
        changes.push(new DatoCMSEntityChange('add', meta, undefined, newAttrs));
      }
    }
    else if (oldE && !newE) {
      if (oldAttrs) {
        changes.push(new DatoCMSEntityChange('del', meta, oldAttrs, undefined));
      }
    }
    else if (newE && oldE) {
      // TODO: use deep diff to extract only modified paths
      if (newAttrs && oldAttrs && _toStr(newAttrs) != _toStr(oldAttrs)) {
        changes.push(new DatoCMSEntityChange('mod', meta, oldAttrs, newAttrs));
      }
    }
    if (newRefs && _toStr(newRefs) != _toStr(oldRefs)) {
      changes.push(new DatoCMSEntityChange('modRefs', meta, oldRefs, newRefs));
    }
    return changes;
  }).flat()
    .filter(x => x);

  return { meta: metaEntities, changes: changes };
}

function pickAttrs(entity) {
  const attrs = _(_.get(entity, 'attributes', {}))
    .omit([
      'id', 'type', 'meta',
      'fields', 'fieldsets', 'itemType',
      ...DatoCMSEntityChange.REF_PATHS
    ])
    .value();
  return !_.isEmpty(attrs) ? structuredClone(attrs) : undefined;
}

function pickRefs(entity) {
  const attrs = _(_.get(entity, 'attributes', {}))
    .pick(DatoCMSEntityChange.REF_PATHS)
    .value();
  return !_.isEmpty(attrs) ? structuredClone(attrs) : undefined;
}

export default envDiff;

function _addLookups(objects) {
  var resp = {
    byId: _.keyBy(objects, "id"),
    ids: objects.map(({id}) => { id }),
    all: objects
  };
  if (objects.length > 0 && objects[0].apiKey) {
    resp["byApiKey"] = _.keyBy(objects, "apiKey");
    resp["apiKeys"] = objects.map(({ apiKey }) => { apiKey });
  }
  return resp
}

function _toStr(obj) {
  return util.inspect(obj, {depth: null, compact: true, sorted: true});
}
