import chalk from "chalk";
import commandLineArgs from "command-line-args";
import getUsage from "command-line-usage";

import DatoCMSEnvironment from "../src/dato_cms_environment.js";

function info(msg) { console.error(chalk.dim(msg)) }
function warn(msg) { console.error(chalk.yellow(msg)) }
function green(msg) { console.error(chalk.green(msg)) }
function err(msg) { console.error(chalk.red(msg)) }

function usage(opts) {
  const sections = [
    {
      header: 'DatoCMS Environment Freeze',
      content: 'Retrieve entities from the given DatoCMS environment, and save them for use in future comparisons',
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
    name: 'env',
    alias: 'e',
    description: 'The name of the environment.',
    type: String,
    typeLabel: '{underline environment}',
  },
  {
    name: 'file',
    alias: 'f',
    description: 'The file to which env JSON will be written.',
    type: String,
    typeLabel: '{underline file}',
  },
];

const options = commandLineArgs(optionDefinitions, { camelCase: true });
if (options.help) {
  usage(optionDefinitions);
}
else {
  info("Loading env from DatoCMS: " + chalk.bold(options.env));
  const env = await DatoCMSEnvironment.getEntities(options.env);

  info("Writing to " + chalk.bold(options.file));
  DatoCMSEnvironment.freeze(env, options.file);
  green('Done!');
}
