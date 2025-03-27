import inquirer from 'inquirer';

export async function localePrompt() {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'locale',
            default: 'en-us',  // Default value
            message: 'Please enter your locale (lowercase)',
        },
    ]);

    return answers.locale;
}