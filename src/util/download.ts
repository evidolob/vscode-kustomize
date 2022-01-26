/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { createWriteStream } from 'fs';
import * as got from 'got';
import stream from 'stream';
import { promisify } from 'util';

const pipeline = promisify(stream.pipeline);

export async function downloadFile(fromUrl: string, toFile: string, progressFn?: (current: number, increment: number) => void): Promise<void> {
  let previous = 0;
  const stream = got.default.stream.get(fromUrl, { isStream: true });
  stream.on('downloadProgress', (progress: got.Progress) => {
    const current = Math.round(progress.percent * 100);
    current !== previous && progressFn && progressFn(current, current - previous);
    previous = current;
  });
  await pipeline(stream, createWriteStream(toFile));
}
