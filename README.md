關於 streamx 拋錯時的問題
=======


`streamx` 是 [gulp](https://gulpjs.com/) 中 `glob-stream` 的依賴之一。
原先因 [Rollup](https://rollupjs.org/) 更像 stream 中的 Readable
而非 Transform 而嘗試將其替換 `gulp.src()` 的工作。
沒錯誤時都如預期中運行，直至測試錯誤場景需要捕獲拋錯時才發現這摸不著頭腦的問題。

**測試時由於無法排除的變因太多，已無心探其原因，所以僅留下有關記錄。**
其變因包含延遲的秒數及時間點、文件目錄的排列或命名，還有特定的第三方在專案的某角落時都會出現不同的情況。


#### 猜測可能的問題

由於筆者對 stream 也不算熟悉，僅根據測試的情況，猜測可能的問題如下：

* 將 `stream.pipe()` 與 `pipeline()` 混用導致。
* `streamx` 的 `Readable._read(cb)` 中的 `cb()` 應該是相當於 `node:stream` 的
  `this.push(null)`，而非像 `glob-stream` 調用多次。
  [官方說明](https://github.com/mafintosh/streamx#rs_readcb)
* streamx 與 stream 有差異，gulp 可能有為其做適應，不過
  gulp 遇錯誤時就是退出，所以此點只是推測。


### 復現問題

_筆者以盡量還原錯誤環境，但測試時偶爾出現同環境出現正反兩種結果，所以與當前電腦環境可能也有關係，有心者可以適時調整下文件參數。 ><_

**首先初始化環境：**

```sh
./init.sh
```

**在單純環境下測試能否捕獲錯誤問題：**

```js
node ./runTryCatch/main.js
        <gsF1Ok|gsF1Fail|gsL1Ok|gsL1Fail|streamx|gsListenOk|stream>
// gsF1Ok      : `glob-stream` 對單文件時成功捕獲錯誤情況
// gsF1Fail    : `glob-stream` 對單文件時失敗情況 (需手動調整文件)
// gsL1Ok      : `glob-stream` 對目錄時成功捕獲錯誤情況
// gsL1Fail    : `glob-stream` 對目錄時失敗情況 (需手動調整文件)
// gsx         : 不完全模擬 gs 邏輯情況 (需手動調整文件)
// streamx     : `streamx` 當 Readable 完成才調用 `cb()` 時成功捕獲錯誤情況
// gsListenOk  : 對 `glob-stream` 使用 `gs.on(error)` 後成功捕獲錯誤情況
// gsListenFail: 對 `glob-stream` 使用 `gs.pipe().on(error)` 後失敗情況
// stream      : 以 `node:stream` 成功捕獲錯誤情況
```

**復現 `glob-stream` 與 `rollup` 組合無法捕獲錯誤的情況：**

```js
// 在單文件時可以捕獲錯誤
node ./runRollupNodeResolve/main.js
// 上述情形下而外加上 pug 的部分第三方而出現無法捕獲錯誤情況
node ./runRollupNodeResolveWithPug/main.js
```

