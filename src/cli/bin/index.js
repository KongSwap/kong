#!/usr/bin/env node
import { Command } from 'commander';
import { deployCommand } from './commands/index.js';
const program = new Command();
program
    .name('kong')
    .description('Command line interface for Kong operations')
    .version('0.0.1');
// Add all commands
program.addCommand(deployCommand);
program.parse(process.argv);
