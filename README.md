# 頂埔607・小小造書家

24 位學生的手抄紙作品展示頁。純 HTML、CSS、JavaScript，可直接部署到 GitHub Pages，不需要安裝套件或執行 build。

## 瀏覽方式

- 首頁顯示全部 24 張封面，每張右下角常駐小字姓名，使用黑色 70% 不透明度、無描邊與底色。滑鼠移入時封面放大；照片不加壓色遮罩。
- 點選後，左側只顯示該生封面放大圖；右側顯示「學習單02」的完整設計圖。
- 目前只顯示設計圖，其他文字題與封底填答頁、翻頁控制均暫時隱藏。原始 CSV 填答仍保留。
- 點選放大封面旁的左右箭頭，或按鍵盤 ← →，可依座號切換上一位／下一位學生，首尾循環瀏覽。
- 關閉按鈕或 Esc 回到全部封面。之後要恢復文字頁，可將 `app.js` 的 `SHOW_TEXT_ANSWERS` 改為 `true`。
- 桌面版固定為整個視窗高度，首頁與內容檢視均不使用捲軸。未設計手機版。
- 13 號的空白作品仍是原本的空白照片；17 號橘色貓咪依確認歸為陳莉蓓。

## 部署 GitHub Pages

1. 建立 GitHub repository，把**此資料夾裡面的檔案**放進 repository 根目錄，讓 `index.html` 位於根目錄。請一併保留 `assets`、`data` 與 `.nojekyll`。
2. 在 repository 的 **Settings → Pages**，Source 選 **Deploy from a branch**。
3. Branch 選 `main`，資料夾選 **/(root)**，按 Save。
4. 等 GitHub 部署完成後，使用 Pages 顯示的網址瀏覽。

已使用相對網址，亦適用 `https://帳號.github.io/repository名稱/` 的子路徑。

部署設定依據：[GitHub Pages 官方說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 校正填答文字

網頁的填答資料庫是 `data/answers.csv`，已由「頂埔學習單_逐題填答.xlsx」的「逐題填答」工作表完整匯出，共 24 列、20 欄。繪圖欄位仍留空，網頁也不會替空白填答推寫內容。

1. 用 Excel 或文字編輯器開啟 `data/answers.csv`。
2. 修改對應學生的填答。保留第一列欄名與座號，每位學生維持一列。
3. 用 **CSV UTF-8（逗號分隔）** 格式儲存。Excel 提示只儲存目前工作表時可接受。
4. 將更新後的 CSV commit / push 到 GitHub；等 Pages 部署完成，重新整理網頁即可顯示修正內容。

頁面只在開啟或重新整理時讀取一次 CSV，沒有定時更新。開著網頁時編輯本機 CSV 不會直接修改 GitHub 上的檔案，需要上傳後重新整理。

填答內可以包含逗號、引號與換行；請讓 Excel 正常儲存 CSV 的引號格式。網頁以純文字顯示資料，不執行其中的 HTML。

若想繼續修改 XLSX 再轉出 CSV，可在電腦安裝 Python 後，於此資料夾執行：

```powershell
python tools/xlsx_to_csv.py "C:\完整路徑\頂埔學習單_逐題填答.xlsx"
```

此工具只使用 Python 標準函式庫，會把指定工作表的資料寫到 `data/answers.csv`。它不會修改 XLSX，也不會重新處理圖片。

## 本機預覽

不能直接雙擊 HTML 讀取 CSV，請使用靜態伺服器。在此資料夾開啟終端機：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

用瀏覽器開啟 `http://127.0.0.1:8765`。停止預覽時，在終端機按 Ctrl+C。

## 檔案

- `index.html`：展示頁。
- `styles.css`：桌面 RWD、動畫與視覺樣式。
- `app.js`：載入 CSV、切換學生、內容分頁。
- `data/answers.csv`：可編輯的填答內容。
- `data/students.json`：座號與封面、設計圖的檔案對應。
- `assets/covers/`：24 張原作品照片，縮圖轉為 WebP。
- `assets/designs/`：24 張學習單02照片，縮圖轉為 WebP。
- `tools/xlsx_to_csv.py`：選用的 XLSX 匯出工具。

網站字型由 Google Fonts 載入，優先使用 [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic)，缺字時使用 [Huninn](https://fonts.google.com/specimen/Huninn)。Zen Maru Gothic 載入 400、500、700、900 字重，保留標題與姓名的粗體；Huninn 缺字補用亦允許瀏覽器呈現粗體。學生姓名（封面浮字、內容標題與封面說明）統一使用 Huninn。網站不依賴外部 JavaScript。
