import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';

inquirer.registerPrompt('search-list', require('inquirer-search-list'));

export default async function fileSystemPrompt() {
    const selectedDir = await selectDirectory();
    if (selectedDir) {
        console.log(chalk.green(`✅ Selected directory: ${selectedDir}`));
    } else {
        console.log(chalk.red('❌ Directory selection canceled.'));
    }
    return selectedDir;
}

async function selectDirectory(startingPath = process.cwd()) {
    let currentPath = startingPath;

    while (true) {
        console.clear();
        // console.log(chalk.yellow(`Current directory: ${currentPath}`));

        // Get directory contents
        const files = fs.readdirSync(currentPath);
        const directories = files.filter(file => 
            fs.statSync(path.join(currentPath, file)).isDirectory()
        );

        // Add navigation options
        const choices = [
            { name: chalk.green('✔ Confirm this directory'), value: 'confirm' },
            { name: chalk.blue('⬆️  Go up one level (..)'), value: 'up' },
            ...directories.map(dir => ({ name: `📁 ${dir}`, value: dir })),
            { name: chalk.red('❌ Cancel'), value: 'cancel' }
        ];

        const { selectedPath } = await inquirer.prompt([
            {
                type: 'search-list',
                name: 'selectedPath',
                message: 'Select a directory:',
                choices
            }
        ]);

        if (selectedPath === 'confirm') {
            return currentPath;
        } else if (selectedPath === 'up') {
            const parentPath = path.dirname(currentPath);
            if (parentPath !== currentPath) {
                currentPath = parentPath;
            }
        } else if (selectedPath === 'cancel') {
            return null;
        } else {
            currentPath = path.join(currentPath, selectedPath);
        }
    }
}
