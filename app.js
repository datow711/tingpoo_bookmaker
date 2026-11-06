"use strict";

// Only page load (or the explicit retry after an error) reads the CSV.
// Student answers remain plain text, including quotes and embedded line breaks.
const COLUMNS = Object.freeze({
  seat: "座號", name: "姓名", q3: "01-3 閱讀感受", q4: "01-4 與其他繪本不同處",
  q5: "01-5 手抄紙用途（文字）", q6: "01-6 我的書主題與名稱",
  q7: "01-7 最喜歡誰的書及原因", q8: "01-8 五次課程印象",
  title: "02 我是一本＿＿的書", back: "02 封底空白處文字"
});
// Keep the text pages available for later; show only the drawing for now.
const SHOW_TEXT_ANSWERS = false;
const PAGES = Object.freeze([
  { label: "我的封面設計", eyebrow: "把想像畫下來", type: "design" },
  { label: "閱讀《情批》這本書，帶給你什麼樣的感覺？", eyebrow: "學習單 01・第 3 題", key: "q3" },
  { label: "這本繪本，與其他繪本有什麼不同的地方？", eyebrow: "學習單 01・第 4 題", key: "q4" },
  { label: "想像一下，手抄紙還可以做成什麼東西？", eyebrow: "學習單 01・第 5 題", key: "q5" },
  { label: "我的書是一本關於什麼的書，他叫什麼名字？", eyebrow: "學習單 01・第 6 題", key: "q6" },
  { label: "在同學之中，我最喜歡誰的書，為什麼？", eyebrow: "學習單 01・第 7 題", key: "q7" },
  { label: "在這五次的課程中，令你印象深刻的事情。", eyebrow: "學習單 01・第 8 題", key: "q8" },
  { label: "寫在封底的想法", eyebrow: "學習單 02・封底空白處", type: "back" }
].filter(page => SHOW_TEXT_ANSWERS || page.type === "design"));
const $ = id => document.getElementById(id);
const exhibition = $("exhibition");
const gallery = $("gallery");
const reader = $("reader");
const pageBody = $("pageBody");
let students = [];
let selected = null;
let pageIndex = 0;
let lastButton = null;
let resizeFrame;

/** RFC 4180: UTF-8 BOM, CRLF/LF, escaped quotes, commas and multiline cells. */
function parseCSV(input) {
  const text = input.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], value = "", quoted = false, afterQuote = false;
  const field = () => { row.push(value); value = ""; afterQuote = false; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else value += c;
    } else if (c === '"' && value === "" && !afterQuote) quoted = true;
    else if (c === ",") field();
    else if (c === "\r" || c === "\n") {
      field(); rows.push(row); row = [];
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else if (afterQuote) {
      if (!/\s/.test(c)) throw new Error("CSV 的引號格式不正確，請以 CSV UTF-8 格式重新儲存。");
    } else value += c;
  }
  if (quoted) throw new Error("CSV 有未結束的引號，請檢查填答欄位。");
  if (value !== "" || row.length || afterQuote) { field(); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ""));
}

function prepareStudents(csv, manifest) {
  const [headers, ...rows] = parseCSV(csv);
  if (!headers || new Set(headers).size !== headers.length) throw new Error("CSV 標題列缺漏或重複。");
  for (const header of Object.values(COLUMNS)) {
    if (!headers.includes(header)) throw new Error(`CSV 缺少「${header}」欄位，請保留原本的欄名。`);
  }
  const assets = new Map(manifest.map(s => [s.seat, s]));
  const seen = new Set();
  const result = rows.map(row => {
    if (row.length !== headers.length) throw new Error("CSV 欄位數不一致，請確認文字中的逗號已正確儲存。");
    const record = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    const seat = Number(record[COLUMNS.seat]);
    if (!assets.has(seat) || seen.has(seat)) throw new Error(`座號「${record[COLUMNS.seat]}」重複或找不到對應作品。`);
    seen.add(seat);
    const student = { ...assets.get(seat), seat };
    for (const [key, col] of Object.entries(COLUMNS)) if (key !== "seat") student[key] = record[col];
    if (!student.name.trim()) throw new Error(`座號 ${seat} 的姓名是空白。`);
    return student;
  });
  if (result.length !== 24) throw new Error("CSV 應有 24 位學生，請確認每位學生各占一列。");
  return result.sort((a, b) => a.seat - b.seat);
}

function renderGallery() {
  const fragment = document.createDocumentFragment();
  for (const student of students) {
    const cell = document.createElement("div");
    cell.className = "cover-cell";
    const button = document.createElement("button");
    button.className = "cover-button";
    button.type = "button";
    button.dataset.seat = String(student.seat);
    button.setAttribute("aria-label", `${student.seat} 號 ${student.name}，開啟作品`);
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-controls", "reader");
    const image = document.createElement("img");
    image.src = student.cover;
    image.alt = `${student.name}的手抄紙封面作品`;
    image.width = 900; image.height = 1200;
    image.decoding = "async";
    image.draggable = false;
    const label = document.createElement("span");
    label.className = "cover-label";
    label.textContent = `${student.seat} ${student.name}`;
    button.append(image, label);
    button.addEventListener("click", () => openStudent(student, button));
    cell.append(button); fragment.append(cell);
  }
  gallery.replaceChildren(fragment);
  gallery.setAttribute("aria-busy", "false");
  fitGrid();
}

// Choose a layout that maximizes the actual 3:4 photographs, not just cell area.
function fitGrid() {
  const { width, height } = gallery.getBoundingClientRect();
  if (!width || !height) return;
  const gap = parseFloat(getComputedStyle(gallery).gap);
  let best = { score: -1, cols: 6, rows: 4 };
  for (let cols = 3; cols <= 12; cols++) {
    const rows = Math.ceil(students.length / cols);
    const w = (width - 16 - gap * (cols - 1)) / cols;
    const h = (height - 16 - gap * (rows - 1)) / rows;
    const photoHeight = Math.min(h, w * 4 / 3);
    const score = photoHeight * photoHeight - (cols * rows - students.length) * 100;
    if (score > best.score) best = { score, cols, rows, photoHeight };
  }
  gallery.style.gridTemplateColumns = `repeat(${best.cols}, minmax(0, 1fr))`;
  gallery.style.gridTemplateRows = `repeat(${best.rows}, minmax(0, 1fr))`;
  gallery.style.setProperty("--cover-height", `${best.photoHeight}px`);
  gallery.style.setProperty("--cover-width", `${best.photoHeight * 3 / 4}px`);
  gallery.dataset.columns = String(best.cols);
}

function openStudent(student, button, { focusClose = true } = {}) {
  selected = student; pageIndex = 0; lastButton = button;
  for (const b of gallery.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b === button));
  $("studentSeat").textContent = String(student.seat).padStart(2, "0");
  $("studentName").textContent = student.name;
  $("selectedCoverImage").src = student.cover;
  $("selectedCoverImage").alt = `${student.seat} 號 ${student.name}的封面作品放大圖`;
  $("selectedCover").hidden = false;
  reader.inert = false;
  reader.setAttribute("aria-hidden", "false");
  exhibition.classList.add("is-open");
  $("galleryHint").textContent = `${student.seat} 號 ${student.name}的封面作品`;
  renderPage();
  if (focusClose) $("closeReader").focus({ preventScroll: true });
  announce(`${student.seat} 號 ${student.name}，我的封面設計`);
}

function changeStudent(direction) {
  if (!selected || students.length < 2) return;
  const currentIndex = students.findIndex(student => student.seat === selected.seat);
  const nextIndex = (currentIndex + direction + students.length) % students.length;
  const student = students[nextIndex];
  const button = gallery.querySelector(`[data-seat="${student.seat}"]`);
  openStudent(student, button, { focusClose: false });
}

function closeReader() {
  if (!selected) return;
  selected = null;
  reader.inert = true;
  reader.setAttribute("aria-hidden", "true");
  exhibition.classList.remove("is-open");
  $("selectedCover").hidden = true;
  fitGrid();
  for (const b of gallery.querySelectorAll("button")) b.setAttribute("aria-pressed", "false");
  $("galleryHint").textContent = "↗ 點選一張封面，翻開創作故事";
  lastButton?.focus({ preventScroll: true });
  announce("已回到全部封面");
}

function makeAnswer(value) {
  const card = document.createElement("div");
  card.className = "answer-card";
  const text = document.createElement("p");
  text.className = "answer-text";
  if (value && value.trim()) text.textContent = value;
  else { text.textContent = "這裡沒有文字填答。"; card.classList.add("is-empty"); }
  card.append(text);
  return card;
}

function renderPage() {
  const page = PAGES[pageIndex];
  $("pageEyebrow").textContent = page.eyebrow;
  $("pageTitle").textContent = page.label;
  pageBody.replaceChildren();
  if (page.type === "design") {
    const image = document.createElement("img");
    image.className = "design-image";
    image.src = selected.design;
    image.alt = `${selected.name}的學習單 02：封面與封底設計圖`;
    pageBody.append(image);
  } else if (page.type === "back") {
    const card = makeAnswer(selected.back);
    if (selected.title.trim()) {
      const title = document.createElement("p");
      title.className = "back-title";
      title.textContent = `我是一本${selected.title}的書`;
      card.prepend(title);
    }
    pageBody.append(card);
  } else pageBody.append(makeAnswer(selected[page.key]));
  pageBody.classList.remove("page-enter");
  void pageBody.offsetWidth;
  pageBody.classList.add("page-enter");
  $("previousPage").disabled = pageIndex === 0;
  $("nextPage").disabled = pageIndex === PAGES.length - 1;
  $("pageCount").textContent = `${String(pageIndex + 1).padStart(2, "0")} / ${String(PAGES.length).padStart(2, "0")}`;
  $("nextHint").textContent = pageIndex === 0 ? "接著，看看我的想法 →" : pageIndex === 7 ? "封底的文字，也是一部分的故事" : "使用 ← → 鍵，也可以翻頁";
  for (const [i, button] of [...$("pageSteps").children].entries()) {
    if (i === pageIndex) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  requestAnimationFrame(fitAnswer);
}

// Fit corrected/longer answers in the fixed-height reader without adding scroll.
function fitAnswer() {
  const text = pageBody.querySelector(".answer-text");
  if (!text) return;
  text.style.fontSize = "";
  text.style.lineHeight = "";
  const card = text.parentElement;
  let size = parseFloat(getComputedStyle(text).fontSize);
  while (card.getBoundingClientRect().height > pageBody.clientHeight - 2 && size > 12) {
    size -= 1;
    text.style.fontSize = `${size}px`;
    text.style.lineHeight = size < 18 ? "1.5" : "1.8";
  }
}

function changePage(index) {
  if (!selected || index < 0 || index >= PAGES.length || index === pageIndex) return;
  pageIndex = index;
  renderPage();
  announce(`${selected.name}，${PAGES[index].label}，第 ${index + 1} 頁，共 ${PAGES.length} 頁`);
}
function announce(text) { $("announcement").textContent = text; }

PAGES.forEach((page, i) => {
  const button = document.createElement("button");
  button.type = "button"; button.className = "page-step";
  button.textContent = String(i + 1).padStart(2, "0");
  button.setAttribute("aria-label", `第 ${i + 1} 頁：${page.label}`);
  button.addEventListener("click", () => changePage(i));
  $("pageSteps").append(button);
});
$("readerFooter").hidden = PAGES.length < 2;
$("previousStudent").addEventListener("click", () => changeStudent(-1));
$("nextStudent").addEventListener("click", () => changeStudent(1));
$("closeReader").addEventListener("click", closeReader);
$("previousPage").addEventListener("click", () => changePage(pageIndex - 1));
$("nextPage").addEventListener("click", () => changePage(pageIndex + 1));
document.addEventListener("keydown", e => {
  if (!selected || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === "Escape") { e.preventDefault(); closeReader(); }
  if (e.key === "ArrowLeft") { e.preventDefault(); changeStudent(-1); }
  if (e.key === "ArrowRight") { e.preventDefault(); changeStudent(1); }
});
new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { fitGrid(); fitAnswer(); });
}).observe(exhibition);
new ResizeObserver(fitGrid).observe(gallery);
new ResizeObserver(fitAnswer).observe(pageBody);
document.fonts.ready.then(fitAnswer);

async function load() {
  const message = $("loadMessage");
  try {
    const [csvResponse, manifestResponse] = await Promise.all([
      fetch(new URL("./data/answers.csv", document.baseURI), { cache: "no-store" }),
      fetch(new URL("./data/students.json", document.baseURI), { cache: "no-store" })
    ]);
    if (!csvResponse.ok || !manifestResponse.ok) throw new Error("作品資料讀取失敗，請確認 data 資料夾已一併上傳。");
    const [csv, manifest] = await Promise.all([csvResponse.text(), manifestResponse.json()]);
    students = prepareStudents(csv, manifest);
    renderGallery();
    message.hidden = true;
  } catch (error) {
    message.classList.add("is-error");
    const heading = document.createElement("h2"); heading.textContent = "作品還沒翻開";
    const explanation = document.createElement("p");
    explanation.textContent = location.protocol === "file:" ? "請透過 GitHub Pages 或本機預覽伺服器開啟，才能讀取 CSV 填答內容。操作方式請見 README。" : error.message;
    const retry = document.createElement("button"); retry.type = "button"; retry.className = "retry-button";
    retry.textContent = "重新讀取"; retry.addEventListener("click", () => location.reload());
    message.replaceChildren(heading, explanation, retry);
  }
}
load();
