import _ from "lodash"
import { SiteClient } from "datocms-client"
import fs from "fs"
import pLimit from "p-limit"
import util from "util";
import v8 from 'v8';

const structuredClone = (obj) => v8.deserialize(v8.serialize(obj));

import DatoCMSEntity from '../src/dato_cms_entity.js';
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

    return metaEntities;
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
