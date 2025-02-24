import * as cliProgress from 'cli-progress';
import colors from 'ansi-colors';
import { clear } from 'console';

interface MultibarOptions {
  name: string;
}

export function createMultibar(options: MultibarOptions): cliProgress.MultiBar {
  const multibar = new cliProgress.MultiBar({
    format:  colors.green('{bar}') + ' {name} | {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: true,
    // change color to yellow between bar complete/incomplete -> incomplete becomes yellow
    // barGlue: '\u001b[33m'
    
  });

  return multibar;
}
