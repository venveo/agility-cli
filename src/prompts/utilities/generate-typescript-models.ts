const FormData = require("form-data");
import { Auth } from "../../auth";
import * as mgmtApi from "@agility/management-sdk";

import { type ContentListFilterModel } from "@agility/management-sdk/dist/models/contentListFilterModel";

import { fileOperations } from "../../fileOperations";
import { localePrompt } from "../locale-prompt";
import { channelPrompt } from "../channel-prompt";
import { isPreviewPrompt } from "../isPreview-prompt";
import inquirer from "inquirer";
import * as path from "path";
import ansiColors = require("ansi-colors");
import { homePrompt } from "../home-prompt";
import fileSystemPrompt from "../file-system-prompt";
import chalkAnimation from 'chalk-animation';
import { AgilityInstance } from "../../types/instance";
import { forceDevMode } from "../..";
const axios = require("axios");


let AI_ENDPOINT_DEV:string = "https://bff.publishwithagility.com/api/ai/cli/typescript-models";
let AI_ENDPOINT_PROD:string = "https://bff.agilitycms.com/api/ai/cli/typescript-models";

let AI_ENDPOINT: string = forceDevMode ? AI_ENDPOINT_DEV : AI_ENDPOINT_PROD;
let auth: Auth;

export default async function generateTypes(selectedInstance: AgilityInstance) {

  console.log(ansiColors.yellow("Generating TypeScript models..."));
  const locale = await localePrompt(selectedInstance);
  const filesPath = await fileSystemPrompt();

  auth = new Auth();
  let code = new fileOperations();

  let data = JSON.parse(code.readTempFile("code.json"));
  const form = new FormData();
  form.append("cliCode", data.code);

  let guid: string = selectedInstance.guid as string;
  let token = await auth.cliPoll(form, guid);

  try {

    console.log('\n')
    let str = "🤖 AI Generating TypeScript models";
    const rainbow = chalkAnimation.pulse(str);

    // Add a new dot every second
    let dotCount = 0;
    setInterval(() => {
      if (dotCount === 3) {
      str = "🤖 AI Generating TypeScript models";
      dotCount = 0;
      } else {
      str += '.';
      dotCount++;
      }
      rainbow.replace(str);
    }, 1000);


    // lets hit the AI_ENDPOINT
    const response = await axios.post(
      AI_ENDPOINT,
      {},
      {
      headers: {
        AUTHORIZATION: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        "agility-guid": guid,
        "agility-locale": locale,
      },
      responseType: "stream",
      }
    );


    const reader = response.data;
    const decoder = new TextDecoder("utf-8");

    let result = "";
    reader.on("data", (chunk: Buffer) => {
      result += decoder.decode(chunk, { stream: true });
    });

    reader.on("end", () => {
      rainbow.stop();
      const modelsFilePath = path.join(filesPath, "models.ts");
      const cleanedResult = result.replace(/^```typescript\s*/, "").replace(/```$/, "");
      code.createFile(modelsFilePath, cleanedResult);
      console.log(ansiColors.green("🚀 TypeScript models generated successfully!"));
      console.log(`\nResponse written to ${modelsFilePath}`);
      homePrompt();
    });

    await new Promise((resolve) => reader.on("end", resolve));
  } catch (error) {
    console.error("Error occurred while hitting AI_ENDPOINT:", error);
  }

}
