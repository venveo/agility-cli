import inquirer from 'inquirer';

export async function localePrompt() {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'locale',
            default: 'en-US',  // Default value
            message: 'Please enter your locale:',
        },
    ]);

    return answers.locale;
}