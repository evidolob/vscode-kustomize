/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecException, spawn, SpawnOptions } from 'child_process';

export interface CliCommand {
  command: string;
  arguments: string[];
}

export interface CliExitData {
  readonly error: ExecException;
  readonly stdout: string;
  readonly stderr: string;
  readonly cwd?: string;
}

export class Cli {
  async execute(cmd: string, args: string[], opts: SpawnOptions = {}): Promise<CliExitData> {
    return new Promise<CliExitData>((resolve) => {
      if (opts.windowsHide === undefined) {
        opts.windowsHide = true;
      }
      if (opts.shell === undefined) {
        opts.shell = true;
      }

      const process = spawn(cmd, args, opts);
      let stdout = '';
      let stderr: string;
      let error: Error;
      process.stdout?.on('data', (data) => {
        stdout += data;
      });
      process.stderr?.on('data', (data) => {
        stderr += data;
      });
      process.on('error', (err) => {
        // do not reject it here, because caller in some cases need the error and the streams
        // to make a decision
        error = err;
      });
      process.on('close', () => {
        resolve({ error, stdout, stderr });
      });
    });
  }
}

export const cli = new Cli();
