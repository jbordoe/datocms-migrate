import _ from "lodash";
import chalk from "chalk";
import commandLineArgs from "command-line-args";
import Highlight from "@babel/highlight";
const highlight = Highlight["default"];
import util from "util";

import DatoCMSEnvironment from "../src/dato_cms_environment.js";
import envDiff from '../src/env_diff.js';
import CodeGenerator from '../src/code_generator.js';
import ChangeManager from '../src/change_manager.js';

function info(msg) { console.error(chalk.dim(msg)) }
function warn(msg) { console.error(chalk.yellow(msg)) }
function green(msg) { console.error(chalk.green(msg)) }
function err(msg) { console.error(chalk.red(msg)) }

function dump(obj) {
  console.error(util.inspect(obj, {colors: true, depth: null}));
}

function summarizeChanges(diff) {
  const changeDict = {
    items: _groupByAction(diff.changes.filter(({entity}) => entity.type === "item")),
    fieldsets: _groupByAction(diff.changes.filter(({entity}) => entity.type === "fieldset")),
    fields: _groupByAction(diff.changes.filter(({entity}) => entity.type === "field")),
    all: _groupByAction(diff.changes),
  };

  const summary = [];
  [
    {type: 'model/block', changes: changeDict.items},
    {type: 'field',       changes: changeDict.fields},
    {type: 'fieldset',    changes: changeDict.fieldsets},
  ].forEach(({type, changes}) => {
    if (changes.add && changes.add.length) {
      summary.push(chalk.greenBright(`  ${changes.add.length} ${type}(s) to create`));
      changes.add.forEach(({entity: obj}) => {
        summary.push(chalk.green(`    + ${obj.label}`));
      });
    }
    if (changes.del && changes.del.length) {
      summary.push(chalk.redBright(`  ${changes.del.length} ${type}(s) to destroy`));
      changes.del.forEach(({entity: obj}) => {
        summary.push(chalk.red(`    - ${obj.label}`));
      });
    }
    const allMod = [...(changes.mod || []), ...(changes.modRef || [])].flat();
    if (allMod && allMod.length) {
      summary.push(chalk.yellowBright(`  ${allMod.length} ${type}(s) to update`));
      allMod.forEach(({entity: obj}) => {
        summary.push(chalk.yellow(`    ~ ${obj.label}`));
      });
    }
  });

  if (!summary.length) {
    warn("\nNo changes to make!");
  }
  else {
    summary.unshift(chalk.bold('\nSummary:'));
    summary.push('');
    console.error(summary.join("\n"));
  }
}

function _groupByAction(changes) {
  return {all: changes, ..._.groupBy(changes, 'action')};
}

async function generate(options) {

  var source_env, target_env;
  if (options.sourceFromFile) {
    const filepath = options.sourceFromFile;
    info("Loading source env from file " + chalk.bold(filepath));
    source_env = DatoCMSEnvironment.thaw(options.sourceFromFile);
  }
  else {
    info("Loading source env from DatoCMS: " + chalk.bold(options.source));
    source_env = await DatoCMSEnvironment.getEntities(options.source);
  }
  if (options.targetFromFile) {
    const filepath = options.targetFromFile;
    info("Loading target env from file " + chalk.bold(filepath));
    target_env = DatoCMSEnvironment.thaw(options.targetFromFile);
  }
  else {
    info("Loading target_env from DatoCMS: " + chalk.bold(options.target));
    target_env = await DatoCMSEnvironment.getEntities(options.target);
  }

  DatoCMSEnvironment.freeze(source_env, "source.json");
  DatoCMSEnvironment.freeze(target_env, "target.json");

  info("Comparing environments...");
  const diff = envDiff(source_env, target_env);

  summarizeChanges(diff);

  if (diff.changes.length) {
    info("Generating instuction set...");
    const migrationSteps = new ChangeManager(99).generateSteps(diff.changes, diff.meta);
    
    info("Translating instructions into Javascript...");
    const codeStr = new CodeGenerator().generate(migrationSteps);

    info('Writing migration code to STDOUT...\n');
    console.log(highlight(codeStr));
  }
  green('Done!');
}

const optionDefinitions = [
  { name: 'source', alias: 's', type: String },
  { name: 'target', alias: 't', type: String },
  { name: 'source-from-file', alias: 'S', type: String },
  { name: 'target-from-file', alias: 'T', type: String },
];

const options = commandLineArgs(optionDefinitions, { camelCase: true });

// TODO: validate options
generate(options);
