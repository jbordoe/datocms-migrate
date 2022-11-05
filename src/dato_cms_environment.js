import _ from "lodash"
import { SiteClient } from "datocms-client"
import fs from "fs"
import pLimit from "p-limit"
import util from "util";
import v8 from 'v8';

const structuredClone = (obj) => v8.deserialize(v8.serialize(obj));

import DatoCMSEntity from '../src/dato_cms_entity.js';
import DatoCMSEntityChange from "../src/entity_change.js";
import MetaEntity from "../src/meta_entity.js";

class DatoCMSEnvironment {

  static async getEntities(env) {
    const client = new SiteClient(
      process.env.DATO_READONLY_API_TOKEN,
      (env === "primary" || !env) ? {} : { environment: env }
    );

    const limit = pLimit(5);

    // TODO: these need to be wrapped in meta entities! we want a list of meta entities!
    var entities = [];
    var items = await client.itemTypes.all();

    for (var item of items) {
      item = new DatoCMSEntity('item', item);
      entities.push(item)

      const fieldsets = await limit(async () => {
        var fieldsets = await client.fieldsets.all(item.id);
        return fieldsets.map((f) => new DatoCMSEntity('fieldset', f, item));
      });
      entities = entities.concat(fieldsets);

      const fields = await limit(async () => {
        var fields = await client.fields.all(item.id);
        return fields.map((f) => new DatoCMSEntity('field', f, item));
      });
      entities = entities.concat(fields);
    }
    return entities;
  }
  
  static diff(sourceEntities, targetEntities) {
    const oldIds = _.keyBy(sourceEntities, 'id');
    const newIds = _.keyBy(targetEntities, 'id');

    const metaEntities = _([...sourceEntities, ...targetEntities])
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
      const [oldAttrs, newAttrs] = [this.#pickAttrs(oldE), this.#pickAttrs(newE)];
      const [oldRefs, newRefs]   = [this.#pickRefs(oldE), this.#pickRefs(newE)];

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
        if (newAttrs && oldAttrs && this.#toStr(newAttrs) != this.#toStr(oldAttrs)) {
          changes.push(new DatoCMSEntityChange('mod', meta, oldAttrs, newAttrs));
        }
      }
      if (newRefs && this.#toStr(newRefs) != this.#toStr(oldRefs)) {
        changes.push(new DatoCMSEntityChange('modRefs', meta, oldRefs, newRefs));
      }
      return changes;
    }).flat()
      .filter(x => x);

    return { meta: metaEntities, changes: changes };
  }

  static #pickAttrs(entity) {
    const attrs = _(_.get(entity, 'attributes', {}))
      .omit([
        'id', 'type', 'meta',
        'fields', 'fieldsets', 'itemType',
        ...DatoCMSEntityChange.REF_PATHS
      ])
      .value();
    return !_.isEmpty(attrs) ? structuredClone(attrs) : undefined;
  }

  static #pickRefs(entity) {
    const attrs = _(_.get(entity, 'attributes', {}))
      .pick(DatoCMSEntityChange.REF_PATHS)
      .value();
    return !_.isEmpty(attrs) ? structuredClone(attrs) : undefined;
  }

  static #toStr(obj) {
    return util.inspect(obj, {depth: null, compact: true, sorted: true});
  }

  static freeze(entities, filename) {
    fs.writeFileSync(
      filename,
      JSON.stringify(entities),
    );
  }

  static thaw(filepath) {
    const entities = JSON.parse(fs.readFileSync(filepath))
      .map(({type, attributes, parentItem}) => {
        return new DatoCMSEntity(
          type,
          attributes,
          parentItem
        );
      });
    const entitiesById = _.keyBy(entities, "id");
    entities.forEach(e => {
      e.parentItem = entitiesById[_.get(e, 'parentItem.id')];
    });
    return entities;
  }
}

export { DatoCMSEnvironment };
export default DatoCMSEnvironment;
