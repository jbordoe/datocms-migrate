import _ from "lodash";
import chalk from "chalk";
import commandLineArgs from "command-line-args";
import getUsage from "command-line-usage";
import Highlight from "@babel/highlight";
const highlight = Highlight["default"];
import util from "util";

import DatoCMSEnvironment from "../src/dato_cms_environment.js";
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
  const entityDict = {
    items: _groupByAction(diff.filter(({ type }) => type === "item")),
    fieldsets: _groupByAction(diff.filter(({ type }) => type === "fieldset")),
    fields: _groupByAction(diff.filter(({ type }) => type === "field")),
  };

  const summary = [];
  [
    {type: 'model/block', entities: entityDict.items},
    {type: 'field',       entities: entityDict.fields},
    {type: 'fieldset',    entities: entityDict.fieldsets},
  ].forEach(({type, entities}) => {
    if (entities.add && entities.add.length) {
      summary.push(chalk.greenBright(`  ${entities.add.length} ${type}(s) to create`));
      entities.add.forEach(entity => {
        summary.push(chalk.green(`    + ${entity.label}`));
      });
    }
    if (entities.del && entities.del.length) {
      summary.push(chalk.redBright(`  ${entities.del.length} ${type}(s) to destroy`));
      entities.del.forEach(entity => {
        summary.push(chalk.red(`    - ${entity.label}`));
      });
    }
    const allMod = [...(entities.mod || []), ...(entities.modRef || [])].flat();
    if (allMod && allMod.length) {
      summary.push(chalk.yellowBright(`  ${allMod.length} ${type}(s) to update`));
      allMod.forEach(entity => {
        summary.push(chalk.yellow(`    ~ ${entity.label}`));
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

function _groupByAction(entities) {
  return _.groupBy(entities, entity => {
    if (entity.source && entity.target) {
      if (entity.label === "Newsletter Page") {
        console.log(entity.diff);
        console.log(entity.refDiff);
      }
      return entity.diff || entity.refDiff ? "mod" : "na";
    }
    else if (entity.source && !entity.target) { return "del" }
    else { return  "add" }
  });
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
  const diff = DatoCMSEnvironment.diff(source_env, target_env);

  summarizeChanges(diff);

  if (diff.length) {
    info("Generating instuction set...");
    const migrationSteps = new ChangeManager(99).generateSteps(diff);

    info("Translating instructions into Javascript...");
    const codeStr = new CodeGenerator().generate(migrationSteps);

    info('Writing migration code to STDOUT...\n');
    console.log(highlight(codeStr));
  }
  green('Done!');
}

function usage(opts) {
  const sections = [
    {
      header: 'DatoCMS Migration Generator',
      content: 'Compare two environments and generate code to migrate the source environment to the target',
    },
    {
      header: 'Options',
      optionList: opts,
      tableOptions: {
        columns: [
          {
            name: 'option',
            width: 30,
          },
          {
            name: 'description',
            width: 50,
          },
        ]
      }
    }
  ];
  console.error(getUsage(sections));
}

const optionDefinitions = [
  {
    name: 'help',
    alias: 'h',
    description: 'Display this usage guide.',
    type: Boolean,
  },
  {
    name: 'source',
    alias: 's',
    description: 'The name of the source environment.',
    type: String,
    typeLabel: '{underline environment}',
  },
  {
    name: 'target',
    alias: 't',
    description: 'The name of the target environment.',
    type: String,
    typeLabel: '{underline environment}',
  },
  {
    name: 'source-from-file',
    alias: 'S',
    description: 'Path of JSON file containing frozen source environment.',
    type: String,
    typeLabel: '{underline file}',
  },
  {
    name: 'target-from-file',
    alias: 'T',
    type: String,
    description: 'Path of JSON file containing frozen target environment.',
    typeLabel: '{underline file}',
  },
];

const options = commandLineArgs(optionDefinitions, { camelCase: true });
if (options.help) {
  usage(optionDefinitions);
}
else {
  generate(options);
}
