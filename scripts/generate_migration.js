import util from "util";
import _ from "lodash";
import chalk from "chalk";
import pLimit from "p-limit";
import { SiteClient } from "datocms-client";
import Highlight from "@babel/highlight";
const highlight = Highlight["default"];

const args = process.argv.slice(2);

const ITEM_REF_PATHS = [
  // Link fields
  'validators.itemItemType.itemTypes',
  // Modular Content Fields
  'validators.richTextBlocks.itemTypes',
  // Structured Text Fields
  'validators.structuredTextBlocks.itemTypes',
  'validators.structuredTextLinks.itemTypes',
];
const FIELD_REF_PATHS = [
  // Modules & Blocks
  'imagePreviewField',
  'exceprtField',
  'orderingField',
  'titleField',
  // Slug Field
  'validators.slugTitleField.titleFieldId',
];
const FIELDSET_REF_PATHS = ['fieldset'];

const REF_PATHS = [ITEM_REF_PATHS, FIELD_REF_PATHS, FIELDSET_REF_PATHS].flat();

function info(msg) { console.error(chalk.dim(msg)) }
function warn(msg) { console.error(chalk.yellow(msg)) }
function green(msg) { console.error(chalk.green(msg)) }
function err(msg) { console.error(chalk.red(msg)) }

function dump(obj) {
  console.error(util.inspect(obj, {colors: true, depth: null}));
}
function toStr(obj) {
  return util.inspect(obj, {depth: null, compact: true});
}

function toMap(objects, key) {
  return Object.assign(
    {},
    ...objects.map((obj) => ({[obj[key]]: obj}))
  );
}

function addLookups(objects) {
  var resp = {
    byId: toMap(objects, 'id'),
    ids: objects.map(({id}) => { id }),
    all: objects
  };
  if (objects.length > 0 && objects[0].apiKey) {
    resp['byApiKey'] = toMap(objects, 'apiKey');
    resp['apiKeys'] = objects.map(({ apiKey }) => { apiKey });
  }
  return resp
}

function findRefs(obj, paths) {
  return paths.map((path) => ({
      id: _.get(obj, path),
      path: path,
      data: _.pick(obj, path)
    }))
    .filter(({ id }) => id && id.length );
}

function objDiff(oldItem, newItem) {
  var mods = {attrs: {}};

  if (oldItem._fieldsets && newItem._fieldsets) {
    const fieldsetsDiff = diff(oldItem._fieldsets, newItem._fieldsets);
    if (fieldsetsDiff) {
      mods['_fieldsets'] = groupByAction(fieldsetsDiff);
    }
  }
  if (oldItem._fields && newItem._fields) {
    const fieldsDiff = diff(oldItem._fields, newItem._fields);
    if (fieldsDiff) {
      mods['_fields'] = groupByAction(fieldsDiff);
    }
  }

  var to_omit = [
    'id', 'itemId', 'itemType',
    '_varName', '_fieldsets', '_fields',
    '_uniqueApiKey', 'fields', 'fieldsets',
  ];
  oldItem = _.omit(oldItem, to_omit);

  for (const key in _.omit(newItem, to_omit)) {
    if (toStr(oldItem[key]) !== toStr(newItem[key])) {
      mods.attrs[key] = newItem[key]
    }
  }
  if (_.isEmpty(mods.attrs)) {
    delete mods.attrs;
  } else {
    mods.attrs = _.omitBy(mods.attrs, ((v, k) => k[0] === '_'));

    const fieldDependencies = findRefs(mods.attrs, FIELD_REF_PATHS)
    mods.attrs = _.omit(mods.attrs, FIELD_REF_PATHS)
    mods['_fieldDependencies'] = fieldDependencies.length ? fieldDependencies : undefined

    const itemDependencies = findRefs(mods.attrs, ITEM_REF_PATHS)
    mods.attrs = _.omit(mods.attrs, ITEM_REF_PATHS)
    mods['_itemDependencies'] = itemDependencies.length ? itemDependencies : undefined

    const fsDependencies = findRefs(mods.attrs, FIELDSET_REF_PATHS)
    mods.attrs = _.omit(mods.attrs, FIELDSET_REF_PATHS)
    mods['_fieldsetDependencies'] = fsDependencies.length ? fsDependencies : undefined

    const allDeps = [...fieldDependencies, ...itemDependencies, ...fsDependencies];
    mods['_allDependencies'] = allDeps.length ? allDeps : undefined;
  }
  return mods;
}

function blankItem() {
  return  {
    _fieldsets: addLookups([]),
    _fields: addLookups([]),
  };
}

// TODO: items should refer to models/blocks, use a more general name
function diff(oldItems, newItems) {
  var metaItems = []
  var mods;

  // TODO: refactor all this
  const toAdd = newItems.all.filter(({ id }) => !oldItems.byId[id])
    .map(item => {
        item['_modified'] = objDiff(blankItem(), item);
        return item
  });

  const shared = oldItems.all.filter(({ id }) => newItems.byId[id])
    .map(oldItem => {
      mods = objDiff(oldItem, newItems.byId[oldItem.id]);
      oldItem['_modified'] = mods;
      return oldItem
    })

  const toMod = shared.filter(({ _modified }) => _modified);
  const noDiff = shared.filter(({ _modified }) => !_modified);

  const toDel = oldItems.all.filter(({ id }) => !newItems.byId[id]);

  for (const newItem of toAdd) {
    mods = newItem._modified;
    delete newItem['_modified'];

    const meta = {
      type: newItem._type,
      id: newItem.id,
      action: 'add',
      new: newItem,
      current: undefined,
      varName: newItem._varName,
      itemVar: newItem._itemVar,
      modified: mods,
    };
    metaItems.push(meta);
  }
  for (const oldItem of toDel) {
    const meta = {
      type: oldItem._type,
      id: oldItem.id,
      action: 'del',
      old: oldItem,
      current: oldItem,
      varName: oldItem._varName,
    };
    metaItems.push(meta);
  }

  for (const oldItem of toMod) {
    mods = oldItem._modified;
    delete oldItem['_modified'];

    const meta = {
      type: oldItem._type,
      id: oldItem.id,
      action: 'mod',
      old: oldItem,
      new: newItems.byId[oldItem.id],
      current: oldItem,
      varName: oldItem._varName,
      modified: mods,
    };
    metaItems.push(meta);
  }
  for (const item of noDiff) {
    const meta = {
      type: item._type,
      id: item.id,
      action: 'none',
      old: item,
      new: item,
      current: item,
      varName: item._varName,
    };
    metaItems.push(meta);
  }
  return metaItems;
}

async function getEntities(env) {
  //TODO: create an RO token specifically for this tool
  const client = new SiteClient(
    process.env.DATO_READONLY_API_TOKEN,
    (env === 'primary' || !env) ? {} : { environment: env }
  );

  const limit = pLimit(5);

  var items = await client.itemTypes.all();

  for (const item of items) {
    item['_varName'] = _.camelCase(item.apiKey + 'Model');
    item['_type'] = 'item';

    item['_fieldsets'] = await limit(async () => {
      var fieldsets = await client.fieldsets.all(item.id);
      fieldsets.forEach((fs) => {
        fs['_varName'] = _.camelCase(item.apiKey + 'fieldset' + fs.title);
        fs['_itemVar'] = item._varName;
        fs['_type'] = 'fieldset';
      });
      return addLookups(fieldsets);
    });

    item['_fields'] = await limit(async () => {
      var fields = await client.fields.all(item.id);
      fields.forEach((field) => {
        field['_varName'] = _.camelCase(item.apiKey + 'field' + field.apiKey);
        field['_uniqueApiKey'] = `${item.apiKey}::${field.apiKey}`;
        field['_itemId'] = item.id;
        field['_itemVar'] = item._varName;
        field['_type'] = 'field';
      });
      return addLookups(fields);
    });
  }
  return addLookups(items);
}

function itemsCreateCode(items, state) {
  if (!items.length) { return '' }

  const omitKeys = ['id', 'fields', '_varName', '_fieldsets', '_fields', '_fieldsets'];
  var code = "/* Create new models/blocks */\n\n"
  for (const item of items) {
    var itemCode = '';
    // only assign to a var if we'll use it later
    if (state.refd.includes(item.id) && !state.vars[item.varName]) {
      code += `const ${item.varName} = `
      state.vars[item.varName] = true;
    }
    const itemObj = util.inspect(_.omit(item.modified.attrs, omitKeys), {depth: null});
    code += `await client.itemTypes.create(${itemObj});`;
    code += "\n\n";
    item.current = item.modified.attrs;
  }
  return code;
}

function itemsDestroyCode(items, state) {
  if (!items.length) { return '' }

  state.flags['pLimit'] = true;
  return `
/* Delete models */
    const removeModels = async(client) => {
    const limit = pLimit(5);

    const modelsToDelete = ${util.inspect(items.map((i) => i.current.apiKey))};
    const promises = modelsToDelete.map(
      (model) => limit(() => client.itemTypes.destroy(model))
    );

    return Promise.all(promises).catch((error) => {
      console.error('Error removing models', error);
      throw error;
    });
  };
  await removeModels(client);
  `
}

function itemsUpdateCode(items, state) {
  if (!items.length) { return '' }

  var code = "/* Update models/blocks */\n\n";
  for (const item of items) {
    // only assign to a var if we'll use it later
    if (state.refd.includes(item.id) && !state.vars[item.varName]) {
      code += `const ${item.varName} = `
      state.vars[item.varName] = true;
    }
    // TODO: use paralellism in generated code?
    code += `await client.itemTypes.update(
      '${item.old.apiKey}',
      ${util.inspect(item.modified.attrs)}
    );
  `;
    item.current = {...item.current, ...item.modified.attrs};
  }
  return code;
}

function itemsRefUpdateCode(items, state) {
  if (!items.length) { return '' }

  var code = "/* Update item references */\n\n";
  for (const item of items.filter(({ modified: m }) => m && m._allDependencies)) {

    var attrs = {}
    for (const { data } of item.modified._allDependencies) {
      attrs = _.merge(attrs, data);
    }
    item.modified.attrs = attrs;
    injectReferenceVars(item, state)
    // TODO: use paralellism in generated code
    code += `await client.field.update(
      '${item.current.apiKey}',
      ${util.inspect(item.modified.attrs, {depth: null})}
    );
  `;
  }
  code = code.replace(/'__REF__|__REF__'/g, '');
  return code;
}

function scopePrepCode(entities, state) {
  if (!entities.length) { return '' }
  entities = {all: entities, ..._.groupBy(entities, 'type')};

  var code = '';
  if (entities.item) {
    state.flags['allItems'] = true;
    const varNames = entities.item.map(({ varName }) => varName);
    const apiKeys = entities.item.map(({ current }) => current.apiKey);

    code += '/* Fetch items referenced below*/\n\n'
    code += `const ${util.inspect(varNames).replaceAll("'","")} = allItems.filter(
      ({ apiKey }) => ${util.inspect(apiKeys)}.includes(apiKey)
    );`;
  }

  if (entities.field) {
    const varNames = entities.field.map(({ varName }) => varName);
    const apiKeys = entities.field
    // ignore anything that hasn't been created yet
      .filter(({ current }) => current)
      .map(({ current }) => current._uniqueApiKey);

    code += `/* Fetch fields referenced below*/`
    code += `const ${util.inspect(varNames).replaceAll("'","")}
      = await Promise.all(
        ${util.inspect(apiKeys)}.map((apiKey) => client.field.find(apiKey))
      );
    `;
  }

  if (entities.fieldset) {
    const varNames = entities.fieldset.map(({ varName }) => varName);
    const ids = entities.fieldset.map(({ id }) => id);

    code += `/* Fetch fields referenced below*/`
    code += `const ${util.inspect(varNames).replaceAll("'","")}
      = await Promise.all(
        ${util.inspect(ids)}.map((fieldsetId) => client.fieldset.find(fieldsetId))
      );
    `;
  }
  entities.all.forEach(({ varName }) => state.vars[varName] = true);
  return code;
}

function fieldsetsCreateCode(fieldsets, state) {
  if (!fieldsets.length) { return '' }

  const omitKeys = ['id', 'itemType', "_varName", "_itemVar"];
  var code = "/* Create fieldsets */\n\n";
  // TODO: group fieldsets by item
  fieldsets = fieldsets.sort(({ itemVar }) => itemVar);

  for (const fieldset of fieldsets) {
    // only assign to a var if we'll use it later
    if (state.refd.includes(fieldset.id) && !state.vars[fieldset.varName]) {
      code += `const ${fieldset.varName} = `
      state.vars[fieldset.varName] = true;
    }
  // TODO: use paralellism in generated code
    code += `await client.fieldset.create(
      ${fieldset.itemVar}.id,
      ${util.inspect(_.omit(fieldset.new, omitKeys))}
    );
  `;
    fieldset.current = fieldset.new;
  }
  return code;
}

function fieldsetsDestroyCode(fieldsets, state) {
  if (!fieldsets.length) { return '' }

  state.flags['pLimit'] = true;
  fieldsets = fieldsets.sort(({ itemVar }) => itemVar);

  return `/* Delete fieldsets */
    const removeFieldsets = async(client) => {
    const limit = pLimit(5);

    const idsToDelete = ${util.inspect(fieldsets.map(({old}) => old.id))};
    const promises = idsToDelete.map(
      (fieldsetId) => limit(() => client.fieldset.destroy(fieldsetId))
    );

    return Promise.all(promises).catch((error) => {
      console.error('Error removing fieldsets', error);
      throw error;
    });
  };
  await removeFieldsets(client);
  `
}

function fieldsetsUpdateCode(fieldsets, state) {
  if (!fieldsets.length) { return '' }

  var code = "/* Update fieldsets */\n";
  // TODO: group fields by item
  fieldsets = fieldsets.sort(({ itemVar }) => itemVar);

  for (const fieldset of fieldsets) {
    // only assign to a var if we'll use it later
    if (state.refd.includes(fieldset.id) && !state.vars[fieldset.varName]) {
      code += `const ${fieldset.varName} = `
      state.vars[fieldset.varName] = true;
    }
  // TODO: use paralellism in generated code
    code += `await client.fieldset.update(
      ${fieldset.id},
      ${util.inspect(fieldset.modified.attrs)}
    );
  `;
  }

  return code
}

function fieldsCreateCode(fields, state) {
  if (!fields.length) { return '' }

  var code = "/* Create fields */\n\n";
  // TODO: group fields by item
  // Slugs reference other fields, so ensure they get created last
  fields = fields.sort(({ new: a}, {new: b}) => {
    if (a.fieldType === 'slug' && b.fieldType !== 'slug') { return 1 }
    else if (a.fieldType !== 'slug' && b.fieldType === 'slug') { return -1 }
    else {
      return a._uniqueApiKey === b._uniqueApiKey
        ? 0 : a._uniqueApiKey < b._uniqueApiKey ? -1 : 1
    }
  });
  for (const field of fields) {
    injectReferenceVars(field, state)
    // only assign to a var if we'll use it later
    if (state.refd.includes(field.id) && !state.vars[field.varName]) {
      code += `const ${field.varName} = `
      state.vars[field.varName] = true;
    }
  // TODO: use paralellism in generated code
    code += `await client.field.create(
      ${field.itemVar}.id,
      ${util.inspect(field.modified.attrs, {depth: null})}
    );
  `;
    field.current = field.modified.attrs;
  }
  code = code.replace(/'__REF__|__REF__'/g, '');
  return code;
}

function fieldsDeleteCode(fields) {
  if (!fields.length) { return '' }

  var code = "/* Delete Fields */\n\n";
  // TODO: group fields by item
  fields = fields.sort(({ old }) => old._uniqueApiKey);
  for (const field of fields) {
  // TODO: use paralellism in generated code
    code += `await client.field.destroy('${field.old._uniqueApiKey}');
`;
  }
  return code;
}

function fieldsUpdateCode(fields, state) {
  if (!fields.length) { return '' }

  var code = "/* Update Fields */\n\n";
  // TODO: group fields by item
  fields = fields.sort(({ old }) => old._uniqueApiKey);
  for (const field of fields) {
    injectReferenceVars(field, state)
    // only assign to a var if we'll use it later
    if (state.refd.includes(field.id) && !state.vars[field.varName]) {
      code += `const ${field.varName} = `
      state.vars[field.varName] = true;
    }
  // TODO: use paralellism in generated code
    code += `await client.field.update(
      '${field.old._uniqueApiKey}',
      ${util.inspect(field.modified.attrs, {depth: null})}
    );
  `;
  }
  code = code.replace(/'__REF__|__REF__'/g, '');
  return code;
}

function injectReferenceVars(entity, state) {
  const deps = entity.modified._allDependencies || [];

  const id2var = (refId) => {
    const refVar = state.id2obj[refId].varName;
    if (!state.vars[refVar]) {
      err(`Variable ${refVar} not yet in scope!`);
//      throw('error');
    }
    return `__REF__${refVar}.id__REF__`;
  }
  for (const {id, path} of deps) {
    const modified = typeof(id) === 'string' ? id2var(id) : id.map(id2var)
    _.set(entity.modified.attrs, path, modified);
  }
}

function findDependencies(changes, state) {
  // Entities with a parent item
  const parentItems = _.map(changes, 'itemVar')
    .filter((v) => v)
    .map((varName) => {
      const obj = state.var2obj[varName];
      if (obj) { return obj } else { throw 'var without object: ' + varName }
    });
  // Items referenced in these entities' attributes
  const refdEntities = changes
    .map(({ modified }) => _.get(modified, '_allDependencies', []))
    .flat()
    .map(({ id }) => id)
    .flat()
    .map((id) => {
      const obj = state.id2obj[id];
      if (obj) { return obj } else { throw 'id without object: ' + id }
    });

  return _.uniqBy([...parentItems, ...refdEntities], 'id')
}

function findAllReferencedIds(changes) {
  const refIds = changes.all.all
    .filter(({ modified }) => modified)
    .map(({ modified: { _allDependencies: deps }}) => deps || [])
    .flat()
    .map(({id}) => id);

  return _.uniq(refIds);
}

function outputCode(changes) {
  var state = {
    vars: {},
    flags: {},
    id2obj: toMap(changes.all.all, "id"),
    var2obj: toMap(changes.all.all, "varName"),
  };
  state['refd'] = findDependencies(changes.all.all, state);

  info("Generating migration code...");
  /* NOTE: the order here is very important
   * We need to ensure entities exist before they can be referenced */
  const deletedItemsCode = itemsDestroyCode(changes.items.del, state);
  const updatedItemsCode = itemsUpdateCode(changes.items.mod, state);
  const newItemsCode = itemsCreateCode(changes.items.add, state)

  // Find items for new fieldsets which are not yet in scope
  const fieldsetRefdItems = findDependencies(changes.fieldsets.add, state)
    .filter(({ varName }) => !(varName in state.vars));
  // Add fieldset items to current scope
  const fieldsetScopePrepCode = scopePrepCode(fieldsetRefdItems, state);

  const newFieldsetsCode = fieldsetsCreateCode(changes.fieldsets.add, state);
  const dropFieldsetsCode = fieldsetsDestroyCode(changes.fieldsets.del, state);
  const updateFieldsetsCode = fieldsetsUpdateCode(changes.fieldsets.mod, state);

  const dropFieldsCode = fieldsDeleteCode(changes.fields.del);
  // Find entities for fields to add, which are not yet in scope
  const fieldRefdItems = findDependencies(changes.fields.all, state)
    .filter(({ varName }) => !(varName in state.vars));
  // Add entities referenced by coming field changes to scope
  const fieldScopePrepCode = scopePrepCode(fieldRefdItems, state);
  const updateFieldsCode = fieldsUpdateCode(changes.fields.mod, state);
  const newFieldsCode = fieldsCreateCode(changes.fields.add, state);

  const itemRefs = findDependencies(changes.items.all, state)
  const itemScopePrepCode = scopePrepCode(itemRefs, state);
  const itemRefsCode = itemsRefUpdateCode(changes.items.all, state);
  info('Writing migration code to STDOUT...\n');
  var str = `${state.flags.pLimit ? "'use strict';" : ""}
const pLimit = require('p-limit');

module.exports = async (client) => {
  ${state.flags.allItems ? "const allItems = client.itemTypes.all();" : ""}
  ${deletedItemsCode}
  ${updatedItemsCode}
  ${newItemsCode}

  ${fieldsetScopePrepCode}
  ${dropFieldsetsCode}
  ${updateFieldsetsCode}
  ${newFieldsetsCode}

  ${fieldScopePrepCode}
  ${dropFieldsCode}
  ${newFieldsCode}
  ${updateFieldsCode}

  ${itemScopePrepCode}
  ${itemRefsCode}
}`

  console.log(highlight(str));
}

function groupByAction(metaItems) {
  return {
    all: metaItems,
    add: metaItems.filter(({action}) => action === 'add'),
    del: metaItems.filter(({action}) => action === 'del'),
    mod: metaItems.filter(({action, modified}) => {
      return action === 'mod' && !_.isEmpty(modified.attrs)
    })
  };
}

function summariseChanges(metaItems) {
  const fsMeta = metaItems.filter(({modified}) => modified && modified._fieldsets)
    .map(({modified}) => modified._fieldsets ? modified._fieldsets.all : [])
    .flat();
  const fieldMeta = metaItems.filter(({modified}) => modified && modified._fields)
    .map(({modified}) => modified._fields ? modified._fields.all : [])
    .flat();

  return {
    items: groupByAction(metaItems),
    fieldsets: groupByAction(fsMeta),
    fields: groupByAction(fieldMeta),
    all: groupByAction([...metaItems, ...fsMeta, ...fieldMeta]),
  };
}

async function generate() {
  const source_env = args[0];
  const target_env = args[1];

  info("Loading source env: " + chalk.bold(source_env));
  const old_env = await getEntities(source_env);

  info("Loading target env: " + chalk.bold(target_env));
  const new_env = await getEntities(target_env);

  info("Comparing environments...");
  const changes = diff(old_env, new_env);

  const summarised = summariseChanges(changes);
  var summary = [chalk.bold('\nSummary:')];
  [
    {type: 'model/block', changes: summarised.items},
    {type: 'field',       changes: summarised.fields},
    {type: 'fieldset',    changes: summarised.fieldsets},
  ].forEach(({type, changes}) => {
    if (changes.add.length) {
      summary.push(chalk.greenBright(`  ${changes.add.length} ${type}(s) to create`));
      changes.add.forEach(({new: obj}) => {
        const label = obj.label || obj.name || obj.title;
        summary.push(chalk.green(`    + ${label}`));
      });
    }
    if (changes.del.length) {
      summary.push(chalk.redBright(`  ${changes.del.length} ${type}(s) to destroy`));
      changes.del.forEach(({current: obj}) => {
        const label = obj.label || obj.name || obj.title;
        summary.push(chalk.red(`    - ${label}`));
      });
    }
    if (changes.mod.length) {
      summary.push(chalk.yellowBright(`  ${changes.mod.length} ${type}(s) to update`));
      changes.mod.forEach(({current: obj}) => {
        const label = obj.label || obj.name || obj.title;
        summary.push(chalk.yellow(`    ~ ${label}`));
      });
    }
  });

  summary.push('');

  if (summary.length == 2) {
    warn("\nNo changes to make, skipping migration");
  } else {
    console.error(summary.join("\n"))
    outputCode(summarised);
  }
  green('Done!');
}

generate();
