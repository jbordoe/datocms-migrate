import _ from "lodash"
import util from "util";

class CodeGenerator {
  generate(changes, meta) {
    this.state = {
      vars: {},
      flags: {},
      id2obj: _.keyBy(meta, "id"),
      var2obj: _.keyBy(meta, "varName"),
      refd: this.findDependencies(changes.all.all),
    };

    // TODO: pass an optional logger into this class
    //info("Generating migration code...");
    /* NOTE: the order here is very important
     * We need to ensure entities exist before they can be referenced */
    const deletedItemsCode = this.itemsDestroyCode(changes.items.del);
    const updatedItemsCode = this.itemsUpdateCode(changes.items.mod);
    const newItemsCode = this.itemsCreateCode(changes.items.add)

    // Find items for new fieldsets which are not yet in scope
    const fieldsetRefdItems = this.findDependencies(changes.fieldsets.add)
      .filter(({ varName }) => !(varName in this.state.vars));
    // Add fieldset items to current scope
    const fieldsetScopePrepCode = this.scopePrepCode(fieldsetRefdItems);

    const newFieldsetsCode = this.fieldsetsCreateCode(changes.fieldsets.add);
    const dropFieldsetsCode = this.fieldsetsDestroyCode(changes.fieldsets.del);
    const updateFieldsetsCode = this.fieldsetsUpdateCode(changes.fieldsets.mod);

    const dropFieldsCode = this.fieldsDeleteCode(changes.fields.del);
    // Find entities for fields to add, which are not yet in scope
    const fieldRefdItems = this.findDependencies(changes.fields.all)
      .filter(({ varName }) => !(varName in this.state.vars));
    // Add entities referenced by coming field changes to scope
    const fieldScopePrepCode = this.scopePrepCode(fieldRefdItems);
    const updateFieldsCode = this.fieldsUpdateCode(changes.fields.mod);
    const newFieldsCode = this.fieldsCreateCode(changes.fields.add);

    const itemRefs = this.findDependencies(changes.items.all)
    const itemScopePrepCode = this.scopePrepCode(itemRefs);
    const itemRefsCode = this.itemsRefUpdateCode(changes.items.all);
    var str = `'use strict';
${this.state.flags.pLimit ? 'const pLimit = require("p-limit");' : ""}

    module.exports = async (client) => {
      ${this.state.flags.allItems ? "const allItems = client.itemTypes.all();" : ""}
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

    return str;
  }

  itemsCreateCode(itemChanges) {
    if (!_.get(itemChanges, 'length')) { return '' }

    var code = "/* Create new models/blocks */\n\n"
    for (const change of itemChanges) {
      var itemCode = '';
      // only assign to a var if we'll use it later
      if (this.state.refd.includes(change.entity.id) && !this.state.vars[change.varName]) {
        code += `const ${change.varName} = `
        this.state.vars[change.varName] = true;
      }
      const itemObj = util.inspect(_.omit(change.to), {depth: null});
      code += `await client.itemTypes.create(${itemObj});`;
      code += "\n\n";
      change.entity.current = {...(change.entity.current || {}), ...change.to};
    }
    return code;
  }

  itemsDestroyCode(items) {
    if (!_.get(items, 'length')) { return '' }

    this.state.flags['pLimit'] = true;
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

  itemsUpdateCode(items) {
    if (!_.get(items, 'length')) { return '' }

    var code = "/* Update models/blocks */\n\n";
    for (const item of items) {
      // only assign to a var if we'll use it later
      if (this.state.refd.includes(item.id) && !this.state.vars[item.varName]) {
        code += `const ${item.varName} = `
        this.state.vars[item.varName] = true;
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

  itemsRefUpdateCode(items) {
    if (!_.get(items, 'length')) { return '' }

    var code = "/* Update item references */\n\n";
    for (const item of items.filter(({ modified: m }) => m && m._allDependencies)) {

      var attrs = {}
      for (const { data } of item.modified._allDependencies) {
        attrs = _.merge(attrs, data);
      }
      item.modified.attrs = attrs;
      this.injectReferenceVars(item)
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

  scopePrepCode(entities) {
    if (!_.get(entities, 'length')) { return '' }
    entities = {all: entities, ..._.groupBy(entities, 'type')};

    var code = '';
    if (entities.item) {
      this.state.flags['allItems'] = true;
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
    entities.all.forEach(({ varName }) => this.state.vars[varName] = true);
    return code;
  }

  fieldsetsCreateCode(changes) {
    if (!_.get(changes, 'length')) { return '' }

    var code = "/* Create fieldsets */\n\n";
    // TODO: group fieldsets by item
    changes = changes.sort(({ entity }) => entity.parent.varName);

    for (const change of changes) {
      // only assign to a var if we'll use it later
      if (this.state.refd.includes(change.entity.id) && !this.state.vars[change.varName]) {
        code += `const ${change.varName} = `
        this.state.vars[change.varName] = true;
      }
      // TODO: use paralellism in generated code
      code += `await client.fieldset.create(
      ${change.entity.parent.varName}.id,
      ${util.inspect(change.to)}
    );
  `;
      change.entity.current = {
        ...(change.entity.current || {}),
        ...change.to
      };
    }
    return code;
  }

  fieldsetsDestroyCode(fsChanges) {
    if (!_.get(fsChanges, 'length')) { return '' }

    this.state.flags['pLimit'] = true;
    fsChanges = fsChanges.sort(({ entity }) => entity.parent.varName);

    return `/* Delete fieldsets */
    const removeFieldsets = async(client) => {
      const limit = pLimit(5);

      const idsToDelete = ${util.inspect(fsChanges.map(({old}) => old.id))};
      const promises = idsToDelete.map(
        (entity) => limit(() => client.fieldset.destroy( entity.id ))
      );

      return Promise.all(promises).catch((error) => {
        console.error('Error removing fieldsets', error);
        throw error;
      });
    };
  await removeFieldsets(client);
  `
    change.entity.current = {
      ...(change.entity.current || {}),
      ...change.to
    };
  }

  fieldsetsUpdateCode(fieldsets) {
    if (!_.get(fieldsets, 'length')) { return '' }

    var code = "/* Update fieldsets */\n";
    // TODO: group fields by item
    fieldsets = fieldsets.sort(({ itemVar }) => itemVar);

    for (const fieldset of fieldsets) {
      // only assign to a var if we'll use it later
      if (this.state.refd.includes(fieldset.id) && !this.state.vars[fieldset.varName]) {
        code += `const ${fieldset.varName} = `
        this.state.vars[fieldset.varName] = true;
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

  fieldsCreateCode(fieldChanges) {
    if (!_.get(fieldChanges, 'length')) { return '' }

    var code = "/* Create fields */\n\n";
    // TODO: group fields by item?
    // Slugs reference other fields, so ensure they get created last
    fieldChanges = fieldChanges.sort((a,b) => {
      if (a.to.fieldType === 'slug' && b.to.fieldType !== 'slug') { return 1 }
      else if (a.to.fieldType !== 'slug' && b.to.fieldType === 'slug') { return -1 }
      else {
        return a.apiKey === b.apiKey ? 0 : a.apiKey < b.apiKey ? -1 : 1
      }
    });
    for (const fieldChange of fieldChanges) {
      this.injectReferenceVars(fieldChange)
      // only assign to a var if we'll use it later
      if (this.state.refd.includes(fieldChange.entity.id) && !this.state.vars[fieldChange.varName]) {
        code += `const ${fieldChange.varName} = `
        this.state.vars[fieldChange.varName] = true;
      }
      // TODO: use paralellism in generated code
      code += `await client.field.create(
      ${fieldChange.entity.parent.varName}.id,
      ${util.inspect(fieldChange.to, {depth: null})}
    );
  `;
      fieldChange.entity.current = {
        ...(fieldChange.entity.current || {}),
        ...fieldChange.to
      };
    }
    code = code.replace(/'__REF__|__REF__'/g, '');
    return code;
  }

  fieldsDeleteCode(fields) {
    if (!_.get(fields, 'length')) { return '' }

    var code = "/* Delete Fields */\n\n";
    // TODO: group fields by item
    fields = fields.sort(({ entity }) => entity.apiKey);
    for (const field of fields) {
      // TODO: use paralellism in generated code
      code += `await client.field.destroy('${field.entity.apiKey}');
`;
    }
    return code;
  }

  fieldsUpdateCode(fields) {
    if (!_.get(fields, 'length')) { return '' }

    var code = "/* Update Fields */\n\n";
    // TODO: group fields by item
    fields = fields.sort(({ old }) => old._uniqueApiKey);
    for (const field of fields) {
      this.injectReferenceVars(field)
      // only assign to a var if we'll use it later
      if (this.state.refd.includes(field.id) && !this.state.vars[field.varName]) {
        code += `const ${field.varName} = `
        this.state.vars[field.varName] = true;
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

  injectReferenceVars(change) {
    const deps = change.refPaths;

    const id2var = (refId) => {
      const refVar = this.state.id2obj[refId].varName;
      if (!this.state.vars[refVar]) {
        err(`Variable ${refVar} not yet in scope!`);
        //      throw('error');
      }
      return `__REF__${refVar}.id__REF__`;
    }
    for (const {id, path} of deps) {
      const modified = typeof(id) === 'string' ? id2var(id) : id.map(id2var)
      _.set(entity.to, path, modified);
    }
  }

  findDependencies(changes) {
    return _(changes)
      .map((ch) => ch.requiredInScope)
      .flatten()
      .filter((v) => !!v)
      .uniqBy('id')
      .value();
  }
}
export default CodeGenerator;
