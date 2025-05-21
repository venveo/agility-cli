import * as fs from 'fs';
import * as Https from 'https';
import * as path from 'path';
const os = require('os');
os.tmpDir = os.tmpdir;

export class fileOperations{

  private _rootPath: string;
  private _guid: string;
  private _locale: string;
  private _isPreview: boolean;
  private _basePath: string;
  private _instanceLogDir: string;
  private _currentLogFilePath: string;

  constructor(rootPath: string, guid: string, locale: string, isPreview: boolean) {
    this._rootPath = rootPath;
    this._guid = guid;
    this._locale = locale;
    this._isPreview = isPreview;
    this._basePath = path.join(this._rootPath, this._guid, this._locale, this._isPreview ? 'preview' : 'live');
    this._instanceLogDir = path.join(this._rootPath, this._guid, this._locale, this._isPreview ? 'preview' : 'live', 'logs');
    this._currentLogFilePath = path.join(this._instanceLogDir, 'instancelog.txt');
  }

    exportFiles(folder: string, fileIdentifier: any, extractedObject: any, baseFolder?: string) {
        let effectiveBase: string;
        if (baseFolder) {
            // If baseFolder is provided, use it directly.
            // It's assumed to be the correct base, whether absolute or relative.
            effectiveBase = baseFolder;
        } else {
            // If no baseFolder is provided, check if the 'folder' argument itself is absolute.
            if (path.isAbsolute(folder)) {
                // If 'folder' is absolute, it defines the complete path up to its own level.
                // So, the effectiveBase is empty string, and 'folder' will be joined from root.
                effectiveBase = "";
            } else {
                // If 'folder' is relative, default to 'agility-files' as the base, relative to CWD.
                effectiveBase = 'agility-files';
            }
        }
        
        // Create the full directory path using path.join for OS-independent path construction
        const directoryForFile = path.join(effectiveBase, folder);
        
        // Ensure the directory structure exists
        if (!fs.existsSync(directoryForFile)) {
            fs.mkdirSync(directoryForFile, { recursive: true });
        }
        
        const fileName = path.join(directoryForFile, `${fileIdentifier}.json`);
        fs.writeFileSync(fileName, JSON.stringify(extractedObject));
    }

    appendFiles(folder: string, fileIdentifier: any, extractedObject: any){
      if(!fs.existsSync(`agility-files/${folder}`)){
        fs.mkdirSync(`agility-files/${folder}`);
      }

      let fileName =  `agility-files/${folder}/${fileIdentifier}.json`;
      fs.appendFileSync(fileName,JSON.stringify(extractedObject));
    }

    createLogFile(folder: string, fileIdentifier: any, baseFolder?: string){
      if(baseFolder === undefined || baseFolder === ''){
        baseFolder = `agility-files`;
      }
      if(!fs.existsSync(`${baseFolder}`)){
        fs.mkdirSync(`${baseFolder}`);
      }
      if(!fs.existsSync(`${baseFolder}/${folder}`)){
          fs.mkdirSync(`${baseFolder}/${folder}`);
      }
      let fileName =  `${baseFolder}/${folder}/${fileIdentifier}.txt`;
      fs.closeSync(fs.openSync(fileName, 'w'))
    }

    appendLogFile(data: string){
      if (!fs.existsSync(this._instanceLogDir)) {
        fs.mkdirSync(this._instanceLogDir, { recursive: true });
      }
      fs.appendFileSync(this._currentLogFilePath, data);
    }
    
    createFolder(folder: string): boolean {
        try {
            let fullPath: string;
            if (path.isAbsolute(folder)) {
                fullPath = folder;
            } else {
                fullPath = path.join('agility-files', folder);
            }
            
            // Normalize the path and split into segments
            const normalizedPath = path.normalize(fullPath);
            const segments = normalizedPath.split(path.sep);
            
            // Start from the root and create each directory
            let currentPath = '';
            for (const segment of segments) {
                currentPath = path.join(currentPath, segment);
                
                // Skip empty segments
                if (!segment) continue;
                
                try {
                    if (!fs.existsSync(currentPath)) {
                        fs.mkdirSync(currentPath);
                    }
                } catch (err) {
                    console.error(`Error creating directory ${currentPath}:`, err);
                    return false;
                }
            }
            
            // Verify the final directory exists
            if (fs.existsSync(normalizedPath)) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.error('Error in createFolder:', error);
            return false;
        }
    }

    createBaseFolder(folder?: string){
      if(folder === undefined || folder === ''){
        folder = `agility-files`;
      }
      if(!fs.existsSync(folder)){
        fs.mkdirSync(folder);
      }
    }

    checkBaseFolderExists(folder: string){
      if(!fs.existsSync(folder)){
        return false;
      }
      return true;
    }

    async downloadFile(url: string, targetFile: string) {  
        return await new Promise((resolve, reject) => {
            // Ensure the target directory exists
            const path = require('path');
            const targetDir = path.dirname(targetFile);
            
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            Https.get(url, response => {
                const code = response.statusCode ?? 0;
        
                if (code >= 400) {
                    return reject(new Error(response.statusMessage));
                }
        
                if (code > 300 && code < 400 && !!response.headers.location) {
                    return resolve(
                        this.downloadFile(response.headers.location, targetFile)
                    );
                }
        
                const fileWriter = fs
                    .createWriteStream(targetFile)
                    .on('finish', () => {
                        resolve({});
                    })
                    .on('error', (err) => {
                        reject(err);
                    });
        
                response.pipe(fileWriter);
            }).on('error', error => {
                console.error(`Error downloading from ${url}:`, error);
                reject(error);
            });
        });
    }

    createFile(filename:string, content: string) {
        fs.writeFileSync(filename, content);
    }

    readFile(fileName: string){
        const file = fs.readFileSync(fileName, "utf-8");
        return file;
    }

    checkFileExists(filePath: string): boolean {
      try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;
      } catch (err) {
        return false;
      }
    }

    deleteFile(fileName: string) {
      fs.unlinkSync(fileName);
  }

  readTempFile(fileName: string){
      let appName = 'mgmt-cli-code';
      let tmpFolder = os.tmpDir();
      let tmpDir = `${tmpFolder}/${appName}`;
      let fileData = this.readFile(`${tmpDir}/${fileName}`);
      return fileData;
  }


  createTempFile(fileName: string, content: string){
      let appName = 'mgmt-cli-code';
      let tmpFolder = os.tmpDir();
      let tmpDir = `${tmpFolder}/${appName}`;
      fs.access(tmpDir, (error) => {
          if(error){
            fs.mkdirSync(tmpDir);
            this.createFile(`${tmpDir}/${fileName}`, content);
          }
          else{
            this.createFile(`${tmpDir}/${fileName}`, content);
          }
      });
      return tmpDir;
  }

  renameFile(oldFile: string, newFile: string){
      fs.renameSync(oldFile, newFile);
  }

  readDirectory(folderName: string, baseFolder?: string){
    if(baseFolder === undefined || baseFolder === ''){
      baseFolder = 'agility-files';
    }
    let directory = `${baseFolder}/${folderName}`;

    let files : string[] = [];
    fs.readdirSync(directory).forEach(file => {
      let readFile = this.readFile(`${directory}/${file}`);
      files.push(readFile);
    })
    
    return files;
  }

  folderExists(folderName: string, baseFolder?: string){
    if(baseFolder === undefined || baseFolder === ''){
      baseFolder = 'agility-files';
    }
    let directory = `${baseFolder}/${folderName}`;
    if(fs.existsSync(directory)){
      return true;
    }
    else{
      return false;
    }
  }

  codeFileExists(){
    let appName = 'mgmt-cli-code';
    let tmpFolder = os.tmpDir();
    let tmpDir = `${tmpFolder}/${appName}/code.json`;
    if(fs.existsSync(tmpDir)){
      return true;
    } 
    else{
      return false;
    }
  }


  deleteCodeFile(){
    let appName = 'mgmt-cli-code';
    let tmpFolder = os.tmpDir();
    let tmpDir = `${tmpFolder}/${appName}/code.json`;
   
    if(fs.existsSync(tmpDir)){
   
      fs.rmSync(tmpDir);

      console.log('Logged out successfully');
      return true;
    } 
    else{
      return false;
    }
  }

  fileExists(path: string){
    if(fs.existsSync(path)){
      return true;
    }
    return false;
  }

  cleanup(path: string) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file) => {
        const curPath = `${path}/${file}`;
        if (fs.lstatSync(curPath).isDirectory()) {
          this.cleanup(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  }

  cliFolderExists(){
    if(fs.existsSync('agility-files')){
      return true;
    } else{
      return false;
    }
  }

  public finalizeLogFile(operationType: 'pull' | 'push'): string {
    const now = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');

    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const timestamp = `${dateStr}-${timeStr}`;

    if (!fs.existsSync(this._currentLogFilePath)) {
      // If the initial log file doesn't exist, there's nothing to rename.
      // This might happen if no logging occurred.
      // We can either create an empty one to signify the operation or just return an expected path.
      // For now, let's log a message and return the expected path if it were created.
      console.warn(`Log file ${this._currentLogFilePath} not found. Cannot finalize.`);
      const newLogFileName = `${operationType}-${timestamp}.txt`;
      return path.join(this._instanceLogDir, newLogFileName);
    }

    const newLogFileName = `${operationType}-${timestamp}.txt`;
    const newLogFilePath = path.join(this._instanceLogDir, newLogFileName);

    try {
      // Ensure the directory exists (it should, if appendLogFile was called)
      if (!fs.existsSync(this._instanceLogDir)) {
        fs.mkdirSync(this._instanceLogDir, { recursive: true });
      }
      fs.renameSync(this._currentLogFilePath, newLogFilePath);
      return newLogFilePath;
    } catch (error) {
      console.error(`Error renaming log file from ${this._currentLogFilePath} to ${newLogFilePath}:`, error);
      // Fallback: return the original path or throw, depending on desired error handling
      return this._currentLogFilePath; // Or throw error;
    }
  }
}