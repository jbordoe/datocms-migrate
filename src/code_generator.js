import _ from "lodash"
import util from "util";

class CodeGenerator {
  generate(steps) {
    var stepCode = steps.map(s => this.#translate(s))
      .filter(line => !!line)
      .join("\n\n");

    const code =
`'use strict'

module.exports = async (client) => {
${stepCode}
}`
    return code;
  }

  #translate(step) {
    switch (step.action + '_' + step.type) {
      case 'add_item':         return this.#addItem(step);
      case 'add_fieldset':     return this.#addFieldset(step);
      case 'add_field':        return this.#addField(step);
      case 'del_item':         return this.#del(step);
      case 'del_fieldset':     return this.#del(step);
      case 'del_field':        return this.#del(step);
      case 'mod_item':         return this.#modItem(step);
      case 'mod_fieldset':     return this.#modFieldset(step);
      case 'mod_field':        return this.#modField(step);
      case 'modRefs_item':     return this.#modItem(step);
      case 'modRefs_fieldset': return this.#modFieldset(step);
      case 'modRefs_field':    return this.#modField(step);
      case 'scope_item':       return this.#scope(step);
      case 'scope_field':      return this.#scope(step);
      case 'scope_fieldset':   return this.#scope(step);
      default:
        console.log("Unsupported step! " + step);
        return undefined;
    }
  }

  #scope(step) {
    const clientType = step.type === "item" ? "itemTypes" : step.type;
    return `const ${step.varName} = await client.${clientType}.find('${step.id}');`;
  }

  #del(step) {
    const clientType = step.type === "item" ? "itemTypes" : step.type;
    return `await client.${clientType}.destroy('${step.id}');`;
  }

  #addItem(step) {
    var code = '';
    if (step.scope) {
      code += `const ${step.varName} = `
    }
    this.#injectReferenceVars(step);
    const itemObj = util.inspect(step.attrs, {depth: null});
    code += `await client.itemTypes.create(${itemObj});`;
    code = code.replace(/'__REF__|__REF__'/g, '');
    return code;
  }

  #modItem(step){
    var code = '';
    if (step.scope) {
      code += `const ${step.varName} = `
    }
    this.#injectReferenceVars(step);
    const itemObj = util.inspect(step.attrs, {depth: null});
    code += `await client.itemTypes.update('${step.id}', ${itemObj});`;
    code = code.replace(/'__REF__|__REF__'/g, '');
    return code;
  }

  #addFieldset(step) {
    var code = '';
    if (step.scope) {
      code += `const ${step.varName} = `
    }
    const fsObj = util.inspect(step.attrs, {depth: null});
    code += `await client.fieldset.create('${step.parentKey}', ${fsObj});`;
    return code;
  }

  #modFieldset(step) {
    var code = '';
    if (step.scope) {
      code += `const ${step.varName} = `
    }
    const fsObj = util.inspect(step.attrs, {depth: null});
    code += `await client.fieldset.update('${step.id}', ${fsObj});`;
    return code;
  }

  #addField(step) {
    var code = '';
    if (step.scope) {
      code += `const ${step.varName} = `
    }
    this.#injectReferenceVars(step);
    const fieldObj = util.inspect(step.attrs, {depth: null});
    code += `await client.field.create('${step.parentKey}', ${fieldObj});`;
    code = code.replace(/'__REF__|__REF__'/g, '');
    return code;
  }

  #modField(step) {
    var code = '';
    if (step.scope) {
      code += `const ${step.varName} = `
    }
    this.#injectReferenceVars(step);
    const fieldObj = util.inspect(step.attrs, {depth: null});
    code += `await client.field.update('${step.id}', ${fieldObj});`;
    code = code.replace(/__REF__'|'__REF__/g, '');
    return code;
  }

  // TODO: this wasn't working properly for lists of ids, create a test case
  #injectReferenceVars(step) {
    _(step.refVars).forEach((vars, path) => {
      const mapped = typeof(vars) === 'string'
        ? `__REF__${vars}.id__REF__`
        : vars.map(v => `__REF__${v}.id__REF__`);
      _.set(step.attrs, path, mapped);
    });
  }
}
export default CodeGenerator;
