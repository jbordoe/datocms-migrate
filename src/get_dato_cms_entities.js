import pLimit from "p-limit"
import { SiteClient } from "datocms-client"
import _ from "lodash"

import DatoCMSEntity from '../src/dato_cms_entity.js';

async function getDatoCMSEntities(env) {
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
  return _addLookups(entities);
}

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

export default getDatoCMSEntities;
