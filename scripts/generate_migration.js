import util from "util";
import _ from "lodash";
import chalk from "chalk";
import pLimit from "p-limit";
import Highlight from "@babel/highlight";
const highlight = Highlight["default"];

import getDatoCMSEntities from '../src/get_dato_cms_entities.js';
import envDiff from '../src/env_diff.js';
import CodeGenerator from '../src/code_generator.js';

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

function addLookups(objects) {
  var resp = {
    byId: _.keyBy(objects, 'id'),
    ids: objects.map(({id}) => { id }),
    all: objects
  };
  if (objects.length > 0 && objects[0].apiKey) {
    resp['byApiKey'] = _.keyBy(objects, 'apiKey');
    resp['apiKeys'] = objects.map(({ apiKey }) => { apiKey });
  }
  return resp
}



function summariseChanges(changes) {
  return {
    items: _groupByAction(changes.filter(({entity}) => entity.type === "item")),
    fieldsets: _groupByAction(changes.filter(({entity}) => entity.type === "fieldset")),
    fields: _groupByAction(changes.filter(({entity}) => entity.type === "field")),
    all: _groupByAction(changes),
  };
}

function _groupByAction(changes) {
  return {all: changes, ..._.groupBy(changes, 'action')};
}

async function generate() {
  const source_env = args[0];
  const target_env = args[1];

  info("Loading source env: " + chalk.bold(source_env));
  const old_env = await getDatoCMSEntities(source_env);

  info("Loading target env: " + chalk.bold(target_env));
  const new_env = await getDatoCMSEntities(target_env);

  info("Comparing environments...");
  const diff = envDiff(old_env.all, new_env.all);

  const summarised = summariseChanges(diff.changes);
  var summary = [chalk.bold('\nSummary:')];
  [
    {type: 'model/block', changes: summarised.items},
    {type: 'field',       changes: summarised.fields},
    {type: 'fieldset',    changes: summarised.fieldsets},
  ].forEach(({type, changes}) => {
    if (changes.add && changes.add.length) {
      summary.push(chalk.greenBright(`  ${changes.add.length} ${type}(s) to create`));
      changes.add.forEach(({entity: obj}) => {
        const label = obj.target.label || obj.target.name || obj.target.title;
        summary.push(chalk.green(`    + ${label}`));
      });
    }
    if (changes.del && changes.del.length) {
      summary.push(chalk.redBright(`  ${changes.del.length} ${type}(s) to destroy`));
      changes.del.forEach(({entity: obj}) => {
        const label = obj.current.label || obj.current.name || obj.current.title;
        summary.push(chalk.red(`    - ${label}`));
      });
    }
    const allMod = [...(changes.mod || []), ...(changes.modRef || [])].flat();
    if (allMod && allMod.length) {
      summary.push(chalk.yellowBright(`  ${allMod.length} ${type}(s) to update`));
      allMod.forEach(({entity: obj}) => {
        const label = obj.current.label || obj.current.name || obj.current.title;
        summary.push(chalk.yellow(`    ~ ${label}`));
      });
    }
  });

  summary.push('');

  if (summary.length == 2) {
    warn("\nNo changes to make, skipping migration");
  } else {
    console.error(summary.join("\n"))
    
    const codeStr = new CodeGenerator().generate(summarised, diff.meta);
    info('Writing migration code to STDOUT...\n');
    console.log(highlight(codeStr));
  }
  green('Done!');
}

generate();
