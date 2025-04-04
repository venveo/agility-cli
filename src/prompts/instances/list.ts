import { Auth } from "../../auth";
import { fileOperations } from "../../fileOperations";
import { homePrompt } from "../home-prompt";
const FormData = require("form-data");

export async function listInstances() {
  let auth = new Auth();
  let code = new fileOperations();
  let data = JSON.parse(code.readTempFile("code.json"));
  const form = new FormData();
  form.append("cliCode", data.code);
  let token = await auth.cliPoll(form, null);
  let user = await auth.getUser(null, token.access_token);
  let instances = user.websiteAccess;
  
  console.log(instances);

  homePrompt("Any other actions you would like to take?");
}
