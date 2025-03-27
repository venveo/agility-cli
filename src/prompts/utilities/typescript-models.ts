const FormData = require("form-data");
import { Auth } from "../../auth";
import * as mgmtApi from "@agility/management-sdk";

import { type ContentListFilterModel } from "@agility/management-sdk/dist/models/contentListFilterModel";

import { fileOperations } from "../../fileOperations";
import { localePrompt } from "../locale";
import { channelPrompt } from "../channel";
import { isPreview } from "../isPreview";
import inquirer from "inquirer";
import * as path from "path";
import ansiColors = require("ansi-colors");
import { homePrompt } from "../home";
import fileSystemPrompt from "../file-system-prompt";
import dotenv from "dotenv";
const axios = require('axios');

dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });


let auth: Auth;
let options: mgmtApi.Options;
const typeMapping: { [key: string]: string } = {
  ImageAttachment: "string",
  Text: "string",
  Number: "number",
  Integer: "number",
  HTML: "string",
  Date: "string",
  DateTime: "string",
  Boolean: "boolean",
  Link: "string",
  FileAttachment: "string",
  RichText: "string",
  OptionSet: "string",
  Module: "string",
  ContentList: "string",
  DropdownList: "string",
  LongText: "string",
  textBlob: "string",
  description: "string",
  title: "string",
  // Add other mappings as needed
};

export default async function generateTypes(selectedInstance: any) {
  const locale = await localePrompt();
  const preview = await isPreview();

  const color = ansiColors;
  console.log(color.yellow(`Current directory: ${process.cwd()}`));

  const filesPath = await fileSystemPrompt();
  console.log("filesPath", filesPath);

  auth = new Auth();
  let code = new fileOperations();

  let data = JSON.parse(code.readTempFile("code.json"));
  const form = new FormData();
  form.append("cliCode", data.code);

  let guid: string = selectedInstance.guid as string;
  let token = await auth.cliPoll(form, guid);

  options = new mgmtApi.Options();
  options.token = token.access_token;

  let apiClient = new mgmtApi.ApiClient(options);

  // lets hit the AI_ENDPOINT
const response = await fetch(process.env.AI_ENDPOINT, {
    method: 'POST',
    headers: {
        "AUTHORIZATION": `BEARER ${token.access_token}`,
        "Content-Type": "application/json",
        "agility-guid": guid
    },
    // body: JSON.stringify({
    //     messages: [
    //         {
    //             role: "user",
    //             content: "Generate typescript models from the Agility Data in the system prompt"
    //         }
    //     ],
    //     stream: true
    // })
});

const reader = response.body.getReader();
const decoder = new TextDecoder("utf-8");
let result = '';

while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
}

console.log('Response:', result);

// const responseData = await response.json();
// const generatedModel = responseData.choices[0].message.content;

// const outputPath = path.join(filesPath, 'generatedModel.ts');
// code.writeFile(outputPath, generatedModel);

// console.log(`Model written to ${outputPath}`);
// const responseData = await response.json();
// console.log(responseData);
  // let contentModules = await apiClient.modelMethods.getContentModules(true, guid, false);
  // let pageModules = await apiClient.modelMethods.getPageModules(true, guid);

  // console.log('contentModules', contentModules);
  // console.log('pageModules', pageModules);

  // async function generateInterface(name: string, moduleId: number): Promise<string> {
  //     let result = `export interface ${name} {\n`;

  //     const fields = await apiClient.modelMethods.getContentModel(moduleId, guid);
  //     for (const field of fields.fields) {
  //         console.log(field)
  //         const tsType = typeMapping[field.type] || "any"; // Default to "any" if no mapping is found
  //         const camelCaseName = field.name.replace(/_([a-z])/g, g => g[1].toUpperCase()).replace(/^([A-Z])/, g => g.toLowerCase());
  //         result += `  ${camelCaseName}: ${tsType};\n`;
  //     }
  //     result += `}\n`;
  //     return result;
  // }

  // async function generateInterfacesFromModules(modules: any, moduleName: string): Promise<string> {
  //     let interfaces = '';
  //     for (const module of modules) {
  //         const interfaceName = module.referenceName.replace('-', '').replace(' ', '');
  //         interfaces += await generateInterface(interfaceName, module.id);
  //     }
  //     return interfaces;
  // }

  // const pageModulesInterfaces = await generateInterfacesFromModules(pageModules, 'PageModule');
  // const contentModulesInterfaces = await generateInterfacesFromModules(contentModules, 'ContentModule');

  // console.log(pageModulesInterfaces);
  // console.log(contentModulesInterfaces);
}
