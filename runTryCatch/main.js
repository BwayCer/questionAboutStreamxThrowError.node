
import fs from 'fs';
import path from 'path';

import {Readable, Transform, Writable} from 'stream';
import {pipeline} from 'stream/promises';

// // 實驗對象
// // streamx 是 glob-stream 的依賴包，也是此問題的起源。
import {Readable as Readablex} from 'streamx';
import gs_ from 'glob-stream';

let isCheckGsStack = false;
function _wrapReadablex(readablex) {
  const readableState = readablex._readableState;
  readableState.updateCallback_ = readableState.updateCallback;
  let isCallAfterRead = false;
  const afterRead_ = readableState.afterRead;
  readableState.afterRead = function (err) {
    isCallAfterRead = true;
    // 修改 _duplexState 後下一步是去調用 updateCallback
    afterRead_(err);
  };
  readableState.updateCallback = function () {
    if (isCallAfterRead) {
      console.log('streamx~afterRead: duplexState:', this.stream._duplexState);
    }
    this.updateCallback_();
  };

  readableState.pipe_ = readableState.pipe;
  readableState.pipe = function (pipeTo, cb) {
    this.pipe_(pipeTo, cb);
    this.pipeline.done_ = this.pipeline.done;
    this.pipeline.done = function (stream, err) {
      console.log(
        'streamx~Pipeline.done:',
        err,
        isCheckGsStack ? Error().stack : '',
      );
      this.done_(stream, err);
    };
  };

  readableState._destroy_ = readableState._destroy;
  readableState._destroy = function (cb) {
    if (opts.destroy) this._destroy = opts.destroy

    this._destroy_((err_) => {
      let err = err_;
      if (!err && this.error.message !== 'Stream was destroyed') {
        err = this.error
      }
      console.log('streamx.afterDestroy:', err);

      cb(err_);
    });
  };

  return readablex;
}
const gs = function (globs, opt) {
  let gsReadCount = 0;

  // glob-stream ---

  const stream = gs_(globs, opt);
  stream._read_ = stream._read;
  stream._read = function (cb) {
    gsReadCount++;
    this._read_(cb);
  };


  // streamx ---
  _wrapReadablex(stream);

  const readableState = stream._readableState;
  let isCallAfterRead = false;
  // afterRead 為 stream._read(cb) 中的 cb
  const afterRead_ = readableState.afterRead;
  readableState.afterRead = function (err) {
    isCallAfterRead = true;
    // 修改 _duplexState 後下一步是去調用 updateCallback
    afterRead_(err);
  };
  readableState.updateCallback = function () {
    if (isCallAfterRead) {
      console.log(
        `streamx#afterRead: cb count: ${gsReadCount};`
        + ' duplexState:', this.stream._duplexState
      );
    }
    this.updateCallback_();
  };

  return stream;
};


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
console.log(_projectDirPath);

const _checkItemName = process.argv[2];
const _checkList = {};

const _delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function _tryCatchOrder(actions) {
  for (let idx = 0, len = actions.length; idx < len; idx++) {
    const currId = idx + 1;
    const action = actions[idx];

    console.log(
      (idx !== 0 ? '\n===\n' : '')
      + `\n:: ${currId}. ${action.title}\n`,
    );
    try {
      await action.fn();
    } catch (err) {
      console.log(`:: ans:${currId} 接住 error.message: ${err.message}`);
    }
  }
  console.log('-- end ---');

  await _delay(7777);
  console.log('-- exit ---');
}

function _touchThrowError(chunk, encoding, callback) {
  // stream 不可用 throw，完全無法被 tryCatch 捕獲
  // callback(null);
  // throw new Error('throw(>_<)');

  this.emit('error', new Error('emit(>_<)'));
  callback(null);
  // same as
  // callback(new Error('callback(>_<)'));
}

function _popupPirateTransform(
  countdown = 4, delay, fnTouch, isFirst = false,
) {
  fnTouch = fnTouch ?? _touchThrowError;
  let _countdown = countdown;
  return new Transform({
    async transform(chunk, encoding, callback) {
      --_countdown;
      const isBoom = _countdown === 0;
      // console.log(`countdown: ${isBoom ? 'boom' : _countdown}; chunk:`, chunk);
      console.log(`countdown: ${isBoom ? 'boom' : _countdown}; chunk:`, typeof chunk);
      if (isFirst && _countdown === countdown - 1 && delay > 0) {
        await _delay(delay);
      }
      if (isBoom) {
        if (!isFirst && delay > 0) {
          await _delay(delay);
        }
        // fnTouch.call(this, chunk, encoding, callback);
        // 加與不加好像沒差。起初是模仿於 GitHub:MikeKovarik/gulp-better-rollup。
        process.nextTick(() => {
          fnTouch.call(this, chunk, encoding, callback);
        });
      } else {
        callback(null, chunk);
      }
    },
    objectMode: true,
  });
}

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

function _gsxReadable(max, delay) {
  let callReadCount = 0;
  let pushId = 0;
  return _wrapReadablex(new Readablex({
    async read(callback) {
      callReadCount++;
      console.log(`_gsxReadable: 調用 read() 次數: ${callReadCount}`);

      if (pushId === 0) {
        (async _ => {
          for (; pushId <= max;) {
            await _delay(delay);
            pushId++;

            console.log(`_gsxReadable: push(${pushId})`);
            this.push(pushId.toString());
          }

          this.push(null);
        })();
      }

      console.log(`_gsxReadable: callback()`);
      callback();
    },
  }));
}

// NOTE:
// * callback 為 streamx 特有，而原生沒有。
// * 雖官方說完全完成後才可調用 `callback()`。
//   (官方說明: https://github.com/mafintosh/streamx#rs_readcb)
// * 若有錯誤，`callback()` 加與不加，擺放位置都關乎錯誤的呈現結果。
function _streamxReadable(max, delay) {
  let callReadCount = 0;
  let pushId = 0;
  return _wrapReadablex(new Readablex({
    async read(callback) {
      callReadCount++;
      console.log(`_streamxReadable: 調用 read() 次數: ${callReadCount}`);

      if (pushId <= max) {
        pushId++;
        await _delay(delay);

        let drained = this.push(pushId.toString());
        console.log(`_streamxReadable: push(${pushId}); drained: ${drained}`);

        if (drained) {
          console.log(`_streamxReadable: callback()`);
          callback();
        }
      } else {
        this.push(null);
        callback();
      }
    },
  }));
}

function _streamReadable(max, delay) {
  let callReadCount = 0;
  let pushId = 0;
  return new Readable({
    async read(size) {
      callReadCount++;
      console.log(
        `stream.Readable: 調用 read() 次數: ${callReadCount}; size: ${size}`
      );

      if (pushId <= max) {
        pushId++; 
        await _delay(delay);

        // size 沒被滿足時，即使發生錯誤也會繼續調用 read()
        // https://nodejs.org/en/docs/guides/backpressuring-in-streams#lifecycle-of-pipe
        let drained = this.push(pushId.toString() + '-'.repeat(size * 8));
        console.log(`stream.Readable: push(${pushId}); drained: ${drained}`);
      } else {
        this.push(null);
      }
    },
    // objectMode: true,
  });
}


// 問題的源頭
// NOTE:
// * delay 這是關鍵。 (process.nextTick() 居然不能起到一樣的效果。)
// * 如果 streamx 的 _duplexState 為 4260448 都有機會被捕獲。
//   不完全清楚 gs 對其的影響，只知與目錄文件數量排列和發生錯誤時的順位有關。
// * 延遲與時間關係是浮動的，測太多次以放棄找準確值，
//   以下僅為筆者某次的實測結果。
// title: 'gs(L1/f21), 1st, 0ms (notPipe) -> ok (duplexState: 4260448)',
// title: 'gs(L1/f21), 1st, 31ms(onBoom) -> ok (duplexState: 4260448)',
// title: 'gs(L1/f21), 1st, 31ms(onFirst) -> ok (duplexState: 4260448)',
// title: 'gs(L1/f21), 1st, 0ms -> fail (duplexState: 4260448)',
// title: 'gs(L1/f21), 1st, 11ms(onBoom) -> fail (duplexState: 4260448)',
// title: 'gs(L1/f21), 1st, 11ms(onFirst) -> fail (duplexState: 4260448)',
// title: 'gs(L1/f21), 1st, 11ms(onBoom) (notPipeline) -> fail (duplexState: 4260448)',
_checkList.gsF1Ok = [
  {
    title: 'gs(L1/f21), 1st, 0ms (notPipe) -> ok (duplexState: 4260448)',
    fn() {
      return _pipePack(
        gs('L1/f21', {cwd: _projectDirPath}),
        _popupPirateTransform(1, 0, _touchThrowError),
      );
    },
  },
  {
    title: 'gs(L1/f21), 1st, 31ms(onBoom) -> ok (duplexState: 4260448)',
    fn() {
      return _pipePack(
        gs('L1/f21', {cwd: _projectDirPath})
          .pipe(_popupPirateTransform(1, 31, _touchThrowError)),
      );
    },
  },
  {
    title: 'gs(L1/f21), 1st, 31ms(onFirst) -> ok (duplexState: 4260448)',
    fn() {
      return _pipePack(
        gs('L1/f21', {cwd: _projectDirPath})
          .pipe(_popupPirateTransform(1, 31, _touchThrowError, true)),
      );
    },
  },
];
_checkList.gsF1Fail = [
  // {
    // title: 'gs(L1/f21), 1st, 0ms -> fail (duplexState: 4260448)',
    // fn() {
      // return _pipePack(
        // gs('L1/f21', {cwd: _projectDirPath})
          // .pipe(_popupPirateTransform(1, 0, _touchThrowError)),
      // );
    // },
  // },
  // {
    // title: 'gs(L1/f21), 1st, 11ms(onBoom) -> fail (duplexState: 4260448)',
    // fn() {
      // return _pipePack(
        // gs('L1/f21', {cwd: _projectDirPath})
          // .pipe(_popupPirateTransform(1, 11, _touchThrowError)),
      // );
    // },
  // },
  // {
    // title: 'gs(L1/f21), 1st, 11ms(onFirst) -> fail (duplexState: 4260448)',
    // fn() {
      // return _pipePack(
        // gs('L1/f21', {cwd: _projectDirPath})
          // .pipe(_popupPirateTransform(1, 11, _touchThrowError, true)),
      // );
    // },
  // },
  {
    title: 'gs(L1/f21), 1st, 11ms(onBoom) (notPipeline) -> fail (duplexState: 4260448)',
    fn() {
      return gs('L1/f21', {cwd: _projectDirPath})
        .pipe(_popupPirateTransform(1, 11, _touchThrowError))
      ;
    },
  },
];
// title: 'gs(L1/L2/Lx/copy/**/*), 2st, 77ms(onBoom) -> ok (duplexState: 4260448)',
// title: 'gs(L1/L2/Lx/copy/**/*), 11st, 77ms(onBoom) -> ok (duplexState: 4260448)',
// title: 'gs(L1/L2/Lx/**/*), 2st, 77ms(onBoom) -> fail (duplexState: 4260448)',
// title: 'gs(L1/L2/Lx/**/*), 3st, 77ms(onBoom) -> ok (duplexState: 4260448)',
// title: 'gs(L1/L2/Lx/**/*), 3st, 77ms(onFirst) -> fail (duplexState: 4260448)',
// title: 'gs(L1/L2/**/*), 11st, 77ms(onBoom) -> fail (duplexState: 4260448)',
// title: 'gs(L1/L2/**/*), 12st, 77ms(onBoom) -> ok (duplexState: 4260448)',
_checkList.gsL1Ok = [
  {
    title: 'gs(L1/L2/Lx/copy/**/*), 2st, 77ms(onBoom) -> ok (duplexState: 4260448)',
    fn() {
      return _pipePack(
        gs('L1/L2/Lx/copy/**/*', {cwd: _projectDirPath})
          .pipe(_popupPirateTransform(2, 77, _touchThrowError)),
      );
    },
  },
  {
    title: 'gs(L1/L2/Lx/copy/**/*), 11st, 77ms(onBoom) -> ok (duplexState: 4260448)',
    fn() {
      return _pipePack(
        gs('L1/L2/Lx/copy/**/*', {cwd: _projectDirPath})
          .pipe(_popupPirateTransform(11, 77, _touchThrowError)),
      );
    },
  },
  {
    title: 'gs(L1/L2/Lx/**/*), 3st, 77ms(onBoom) -> ok (duplexState: 4260448)',
    fn() {
      return _pipePack(
        gs('L1/L2/Lx/**/*', {cwd: _projectDirPath})
          .pipe(_popupPirateTransform(3, 77, _touchThrowError)),
      );
    },
  },
  {
    title: 'gs(L1/L2/**/*), 12st, 77ms(onBoom) -> ok (duplexState: 4260448)',
    fn() {
      return _pipePack(
        gs('L1/L2/**/*', {cwd: _projectDirPath})
          .pipe(_popupPirateTransform(12, 77, _touchThrowError)),
      );
    },
  },
];
_checkList.gsL1Fail = [
  // {
    // title: 'gs(L1/L2/Lx/**/*), 2st, 77ms(onBoom) -> fail (duplexState: 4260448)',
    // fn() {
      // return _pipePack(
        // gs('L1/L2/Lx/**/*', {cwd: _projectDirPath})
          // .pipe(_popupPirateTransform(2, 77, _touchThrowError)),
      // );
    // },
  // },
  // {
    // title: 'gs(L1/L2/Lx/**/*), 3st, 77ms(onFirst) -> fail (duplexState: 4260448)',
    // fn() {
      // return _pipePack(
        // gs('L1/L2/Lx/**/*', {cwd: _projectDirPath})
          // .pipe(_popupPirateTransform(3, 77, _touchThrowError, true)),
      // );
    // },
  // },
  {
    title: 'gs(L1/L2/**/*), 11st, 77ms(onBoom) -> fail (duplexState: 4260448)',
    fn() {
      return _pipePack(
        gs('L1/L2/**/*', {cwd: _projectDirPath})
          .pipe(_popupPirateTransform(11, 77, _touchThrowError)),
      );
    },
  },
];


// 不完全模擬 gs，不較真，只看變數差異確實影響捕獲錯誤能力
// L2: 36, Lx: 17, copy: 11
// title: 'gsx(1..11) 111ms, 4st, 77ms(onBoom) -> fail (duplexState: 4260448)',
// title: 'gsx(1..11) 77ms, 4st, 77ms(onBoom) -> ok (duplexState: 4260448) (有出現過fail)',
// title: 'gsx(1..17) 77ms, 11st, 77ms(onBoom) -> fail (duplexState: 4260448)',
_checkList.gsx = [
  // {
    // title: 'gsx(1..11) 111ms, 11st, 77ms(onBoom) -> fail (duplexState: 4260448)',
    // fn() {
      // return _pipePack(
        // _gsxReadable(11, 111)
          // .pipe(_popupPirateTransform(11, 77, _touchThrowError))
        // ,
      // );
    // },
  // },
  // {
    // title: 'gsx(1..11) 77ms, 11st, 77ms(onBoom) -> ok (duplexState: 4260448) (有出現過fail)',
    // fn() {
      // return _pipePack(
        // _gsxReadable(11, 77)
          // .pipe(_popupPirateTransform(11, 77, _touchThrowError))
        // ,
      // );
    // },
  // },
  // {
    // title: 'gsx(1..17) 77ms, 11st, 77ms(onBoom) -> fail (duplexState: 4260448)',
    // fn() {
      // return _pipePack(
        // _gsxReadable(17, 77)
          // .pipe(_popupPirateTransform(11, 77, _touchThrowError))
        // ,
      // );
    // },
  // },
];

// streamx 完全完成後才調用 `callback()`
_checkList.streamx = [
  {
    title: 'streamx(1..13) 111ms, 11st, 77ms(onBoom) -> ok (duplexState: 4227776)',
    fn() {
      return _pipePack(
        _streamxReadable(13, 111)
          .pipe(_popupPirateTransform(11, 77, _touchThrowError))
        ,
      );
    },
  },
  {
    title: 'streamx(1..13) 77ms, 11st, 77ms(onBoom) -> ok (duplexState: 4227776) (有出現過fail)',
    fn() {
      return _pipePack(
        _streamxReadable(13, 77)
          // .pipe(_popupPirateTransform(11, 77, _touchThrowError))
          .pipe(_popupPirateTransform(11, 77, _touchThrowError))
        ,
      );
    },
  },
  {
    title: 'streamx(1..17) 77ms, 11st, 77ms(onBoom) -> fail (duplexState: 4227716)',
    fn() {
      return _pipePack(
        _streamxReadable(17, 77)
          .pipe(_popupPirateTransform(11, 77, _touchThrowError))
        ,
      );
    },
  },
];

// gs 使用監聽情況
_checkList.gsListenOk = [
  {
    title: 'gs(L1/L2/**/*).on(error), 11st, 77ms(onBoom) -> fail (duplexState: 4260448)',
    fn() {
      let readable = gs('L1/L2/**/*', {cwd: _projectDirPath});
      readable.on('error', error => {
        console.error('捕獲錯誤:', error.message);
      });
      readable = readable.pipe(_popupPirateTransform(11, 77, _touchThrowError));
      return _pipePack(readable);
    },
  },
];
_checkList.gsListenFail = [
  {
    title: 'gs(L1/L2/**/*).pipe().on(error), 11st, 77ms(onBoom) -> fail (duplexState: 4260448)',
    fn() {
      let readable = gs('L1/L2/**/*', {cwd: _projectDirPath});
      readable = readable.pipe(_popupPirateTransform(11, 77, _touchThrowError));
      readable.on('error', error => {
        console.error('捕獲錯誤:', error.message);
      });
      return _pipePack(readable);
    },
  },
];

// node stream
_checkList.stream = [
  {
    title: 'stream(1..17) 77ms, 11st, 0ms(onBoom) -> ok',
    fn() {
      return _pipePack(
        _streamReadable(17, 77)
          .pipe(_popupPirateTransform(11, 0, _touchThrowError))
        ,
      );
    },
  },
];


if (Object.hasOwn(_checkList, _checkItemName)) {
  await _tryCatchOrder(_checkList[_checkItemName]);
} else {
  throw new Error(`找不到 ${_checkItemName} 驗證項目`);
}

