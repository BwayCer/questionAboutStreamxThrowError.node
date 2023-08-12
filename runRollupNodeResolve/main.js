
import fs from 'fs';
import path from 'path';

import {Readable, Transform, Writable} from 'stream';
import {pipeline} from 'stream/promises';
import {rollup} from 'rollup';
import rollupNodeResolve from '@rollup/plugin-node-resolve';

import gs from 'glob-stream';

const _filename = import.meta.url.substring(7);
const _dirname = path.dirname(_filename);

const _projectDirPath = (_ => {
  let dirPath = _dirname;
  for (; dirPath !== '/';) {
    if (fs.existsSync(path.join(dirPath, 'package.json'))) {
      return dirPath;
    }
    dirPath = path.dirname(dirPath);
  }
  throw new Error('找不到專案目錄');
})();

const _delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function _pipePack(...args) {
  return pipeline(
    ...args,
    new Writable({
      write(chunk, encoding, callback) {
        // console.log('chunk:', chunk);
        callback();
      },
      objectMode: true,
    }),
  );
}


try {
  await _pipePack(
    gs(
      'checkFile/sampleProject/**/errorRollupPack.js',
      {cwd: _projectDirPath}
    ).pipe(new Transform({
      async transform(file, encoding, callback) {
        try {
          let bundle = await rollup({
            input: file.path,
            external: (id, fromPath) => {
              console.log(`\n  id: ${id}\n  fp: ${fromPath}\n---`);
              return false;
            },
            plugins: [
              rollupNodeResolve({
                browser: true,
                preferBuiltins: false,
                moduleDirectories: ['node_modules', 'modules'],
              }),
            ],
          });

          await bundle.generate({}).then(result => {
            let realOutputs
              = result.output.filter(item => item.type === 'chunk');
            let output = realOutputs[0];

            let filePath = file.path;
            let targetFile = {
              ...file,
              contents: Buffer.from(output.code, encoding),
            };

            this.push(targetFile);
          });

          callback(null);
        } catch (err) {
          process.nextTick(() => {
            this.emit('error', err);
            callback(null);
          });
        }
      },
      objectMode: true,
    })),
  );
} catch (err) {
  console.log(`:: 接住 error.message: ${err.message}`);
}
console.log('-- end ---');

