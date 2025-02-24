import { fileOperations } from "../fileOperations";
import process from "process";
export async function logout() {
    console.log("Logging out...");
    let code = new fileOperations();
    code.deleteCodeFile();

    process.exit(0);

  }