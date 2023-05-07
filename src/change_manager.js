import _ from "lodash"
import v8 from 'v8';

const clone = (obj) => v8.deserialize(v8.serialize(obj));

import DatoCMSEntity from '../src/dato_cms_entity.js';

class ChangeManager {
  static SORT_KEYS = [
    'scope',
    'item.del', 'item.mod', 'item.add',
    'fieldset.del', 'fieldset.mod', 'fieldset.add',
    'field.del', 'field.mod', 'field.add',
    // TODO: handle this more sensibly
    'slug.add', 'slug.modRefs',
    'slug.del', 'slug.mod',
    'item.modRefs', 'field.modRefs',
  ].reduce((obj, el, i) => ({[el]: i, ...obj}), {});

  constructor(seed = 42) {
    this.seed = seed;
  }

  generateSteps(entities) {
    this.committed = [];
    this.state = {
      vars: {},
      entities: entities,
      entityIds: _.keyBy(entities, "id"),
      current: entities.filter(({current}) => !!current).map(({id}) => id),
      inScope: new Set(),
      id2var: entities.reduce((obj, {id, varName}) => ({[id]: varName, ...obj}), {}),
    }

    var steps = _(entities)
      .map((ch) => this.#convert(ch))
      .flatten()
      .sortBy(step => this.#sortKey(step))
      .value();

    steps = this.#handleScope(steps);
    this.#commit(steps);

    return this.committed;
  }


  #step(action, entity) {
    return {
      action: action,
      type: _.get(entity, 'type'),
      entity: entity,
      varName: _.get(entity, 'varName'),
      idType: _.get(entity, 'idType'), 
      scope: action === "scope",
      parentVar: _.get(entity, 'parent.varName'),
//      refdIds: _.get(entity, 'refdIds'), 
//      refPaths: _.get(entity, 'refPaths'),
      attrs: clone(
        _.get(entity, action === "modRefs" ? 'refDiff' : 'diff')),
    };
  }
  #scope(entity) {
    return this.#step("scope", entity);
  }
  #convert(entity) {
    const steps = []
    
    if (entity.refDiff) { steps.push(this.#step("modRefs", entity)) }
    if (entity.source && entity.target) {
      if (entity.diff) { steps.push(this.#step("mod", entity)) }
    }
    else {
      const action = entity.source && !entity.target ? "del" : "add";
      steps.push(this.#step(action, entity));
    }
    return steps;
  }

  #refPaths(step) {
    return DatoCMSEntity.REF_PATHS
      .filter((path) => _.get(step.attrs, path));
  }
  #refdIds(step) {
    return this.#refPaths(step)
      .map(path => _.get(step.attrs, path))
      .filter(ref => !!ref)
      .flat();
  }

  #sortKey(step) {
    if (_.get(step.entity.source || step.entity.target, 'attributes.fieldType') === "slug") {
      return ChangeManager.SORT_KEYS[`slug.${step.action}`];
    }
    else if (step.type === "scope") {
      return ChangeManager.SORT_KEYS['scope'];
    }
    else {
      return ChangeManager.SORT_KEYS[`${step.type}.${step.action}`];
    }
  }

  #allRequirements(steps) {
    var toScope = _([steps].flat())
      .map((step) => this.#stepScopeReqs(step))
      .flatten()
      .uniq()
      .value();
    return new Set(toScope);
  }

  #handleScope(steps) {
    const toScope = this.#allRequirements(steps);
    const inScope = new Set();

    return steps.map((step) => {
      if (["add", "mod", "modRefs"].includes(step.action)
        && toScope.has(step.entity.id)) {
        step.scope = true;
        inScope.add(step.entity.id);
        toScope.delete(step.entity.id);
      }
      const scopeSteps = this.#stepScopeReqs(step, inScope)
        .map(reqId => this.#scope( this.state.entityIds[reqId] ));

      // TODO: test the ordering here
      return [...scopeSteps, step]
    }).flat();
  }

  #stepScopeReqs(step, inScope = new Set()) {
    return (this.#refdIds(step) || [])
      .filter(refId => !inScope.has(refId));
  }

  #commit(steps) {
    [steps].flat().map((step) => this.#commitStep(step));
  }

  #commitStep(step) {
    if (["mod", "modRefs"].includes(step.action)) {
      const updatedAttrs = step.entity.changes(step.attrs);
      // If the updates won't have an effect on the entity, do nothing
      if (!updatedAttrs) { return }
      else { step.attrs = updatedAttrs }
    }
    if (["add", "del", "mod", "modRefs"].includes(step.action)) {
      // TODO: meta-entity updates should accept steps not changes
      step.entity.updateState({action: step.action, to: step.attrs})
    }
    // TODO: this shouldn't be necessary
    if (step.scope && this.state.inScope.has(step.entity.id)) {
      step.scope = false;
      if (step.action == "scope") { return }
    }
    if (step.action === "del") {
      // TODO: why aren't we removing entity.id from inScope?

      // This field/set may not be present because parent has already been deleted
      // If so, we don't need to commit this step
      if (!this.state.current.includes(step.entity.id)) { return }
      // TODO: test that items aren't added to scope twice

      // TODO: When we delete an item, mark all it's field/sets as deleted too
      // TODO: need more detail in current state. E.g when I delete a field,
      // the position of all other subsequent fields should automatically change.
      // After this, any position updates that do the same should be dropped
      // More generally - try to simulate effects of each step on entities, and
      // take that into account to modify or drop steps before comitting
      if(step.type === "item") {
        this.state.entities.filter((e) => _.get(e, "parent.id") === step.entity.id)
          .forEach((e) => e.current = null);
      }
    }
    else {
      const refPaths = this.#refPaths(step) || [];
      const refVars = {};
      refPaths
        .filter(p => !!_.get(step.attrs, p))
        .forEach(path => {
        const refId = _.get(step.attrs, path);
        const varName = typeof(refId) === 'string'
          ? this.state.id2var[refId]
          : refId.map(r => this.state.id2var[r]);

        refVars[path] = varName;
      })
      step['refVars'] = refVars;
    }
    if (step.entity && step.idType) { step.id = step.entity[step.idType] }
    if (step.scope) {
      this.state.vars[step.varName] = true;
      this.state.inScope.add(step.entity.id)
      step.parentKey = _.get(step.entity, 'parent.apiKey');
    }
    step.parentKey = _.get(step, 'entity.parent.apiKey');
    // TODO: whut? 
    this.state.current = this.state.entities.filter(({current}) => !!current).map(({id}) => id);
    this.committed.push(_.omit(step, "entity"))
  }
}
export default ChangeManager;
