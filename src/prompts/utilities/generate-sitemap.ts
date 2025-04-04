import * as fs from 'fs';
import * as path from 'path';
import { localePrompt } from '../locale-prompt';
import fileSystemPrompt from '../file-system-prompt';



const generateSitemap = async () => {

    const locale = await localePrompt();
    const filesPath = await fileSystemPrompt();

    const envFilePath = path.resolve(process.cwd(), '.env.local');
    const envVariables: Record<string, string> = {};


    const envContent = Object.entries(envVariables)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    fs.writeFileSync(envFilePath, envContent, 'utf8');
    console.log(`.env.local file has been generated at ${envFilePath}`);
    // rl.close();
};

