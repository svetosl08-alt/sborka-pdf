import { buildPdf } from './pdf.js';
import { extractJpegs } from './extract.js';

const MAX_SIDE = 2400; // ограничение стороны изображения в пикселях, чтобы PDF не был слишком большим

const HINTS = {
  build:
    'Загрузите изображения (PNG или JPG). Каждое вписывается на отдельный лист A4 с сохранением пропорций. Файлы никуда не отправляются: PDF собирается в браузере.',
  extract:
    'Загрузите PDF. Приложение найдёт встроенные JPEG-изображения (фото, сканы) и предложит скачать каждое отдельно. Векторные чертежи и текст из PDF не извлекаются.',
};

const fileInput = document.getElementById('fileInput');
const fileBtnText = document.getElementById('fileBtnText');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const hintEl = document.getElementById('hint');
const marginInput = document.getElementById('margin');
const orientationSelect = document.getElementById('orientation');
const buildOptions = document.getElementById('buildOptions');
const actionBtn = document.getElementById('action');
const statusEl = document.getElementById('status');
const downloadLink = document.getElementById('download');
const resultsEl = document.getElementById('results');
const modeInputs = document.querySelectorAll('input[name="mode"]');

let mode = 'build';
/** @type {{file: File, url: string}[]} */
const images = [];
/** @type {{file: File}[]} */
const pdfs = [];
/** @type {{name: string, url: string}[]} */
let results = [];
let lastPdfUrl = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function hideDownload() {
  downloadLink.hidden = true;
  if (lastPdfUrl) {
    URL.revokeObjectURL(lastPdfUrl);
    lastPdfUrl = null;
  }
}

function clearResults() {
  results.forEach((r) => URL.revokeObjectURL(r.url));
  results = [];
  resultsEl.innerHTML = '';
}

function currentList() {
  return mode === 'build' ? images : pdfs;
}

function setMode(newMode) {
  mode = newMode;
  const isBuild = mode === 'build';
  fileInput.accept = isBuild ? 'image/png,image/jpeg' : 'application/pdf';
  fileBtnText.textContent = isBuild ? 'Выбрать изображения' : 'Выбрать PDF-файлы';
  buildOptions.hidden = !isBuild;
  actionBtn.textContent = isBuild ? 'Создать PDF' : 'Извлечь фото';
  hintEl.textContent = HINTS[mode];
  setStatus('');
  hideDownload();
  clearResults();
  render();
}

function render() {
  const isBuild = mode === 'build';
  const items = currentList();
  list.innerHTML = '';

  items.forEach((item, index) => {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = item.file.name;
    info.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'actions';

    if (isBuild) {
      const thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = item.url;
      thumb.alt = '';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = `Страница ${index + 1}`;
      info.appendChild(num);
      actions.append(
        makeBtn('↑', 'Переместить выше', index === 0, () => move(index, -1)),
        makeBtn('↓', 'Переместить ниже', index === items.length - 1, () => move(index, 1))
      );
      li.appendChild(thumb);
    } else {
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = 'PDF-файл';
      info.appendChild(num);
    }

    actions.appendChild(makeBtn('✕', 'Удалить', false, () => remove(index), true));
    li.append(info, actions);
    list.appendChild(li);
  });

  empty.textContent = isBuild ? 'Изображения пока не выбраны' : 'PDF-файлы пока не выбраны';
  empty.hidden = items.length > 0;
  actionBtn.disabled = items.length === 0;
}

function renderResults() {
  resultsEl.innerHTML = '';
  if (results.length === 0) return;

  const heading = document.createElement('h2');
  heading.className = 'results-title';
  heading.textContent = 'Найденные изображения';
  resultsEl.appendChild(heading);

  const ul = document.createElement('ul');
  ul.className = 'list';
  results.forEach((r) => {
    const li = document.createElement('li');
    const thumb = document.createElement('img');
    thumb.className = 'thumb';
    thumb.src = r.url;
    thumb.alt = '';

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = r.name;
    info.appendChild(name);

    const save = document.createElement('a');
    save.className = 'save';
    save.href = r.url;
    save.download = r.name;
    save.textContent = 'Скачать';

    li.append(thumb, info, save);
    ul.appendChild(li);
  });
  resultsEl.appendChild(ul);
}

function makeBtn(text, label, disabled, onClick, danger = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = danger ? 'icon-btn danger' : 'icon-btn';
  btn.textContent = text;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

function move(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= images.length) return;
  [images[index], images[target]] = [images[target], images[index]];
  hideDownload();
  render();
}

function remove(index) {
  if (mode === 'build') {
    URL.revokeObjectURL(images[index].url);
    images.splice(index, 1);
  } else {
    pdfs.splice(index, 1);
  }
  hideDownload();
  setStatus('');
  render();
}

modeInputs.forEach((input) => {
  input.addEventListener('change', () => {
    if (input.checked) setMode(input.value);
  });
});

fileInput.addEventListener('change', () => {
  for (const file of fileInput.files) {
    if (mode === 'build') {
      if (/^image\/(png|jpeg)$/.test(file.type)) images.push({ file, url: URL.createObjectURL(file) });
    } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      pdfs.push({ file });
    }
  }
  fileInput.value = '';
  hideDownload();
  setStatus('');
  render();
});

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = url;
  });
}

// Перерисовываем изображение на белый фон и сохраняем как JPEG (PDF встраивает JPEG напрямую)
async function toJpeg(url) {
  const img = await loadImage(url);
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  w = Math.round(w * k);
  h = Math.round(h * k);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Ошибка кодирования'))), 'image/jpeg', 0.92);
  });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}

async function runBuild() {
  hideDownload();
  try {
    const pages = [];
    for (let i = 0; i < images.length; i++) {
      setStatus(`Обработка ${i + 1} из ${images.length}…`);
      pages.push(await toJpeg(images[i].url));
    }
    const margin = Math.min(50, Math.max(0, Number(marginInput.value) || 0));
    const pdf = buildPdf(pages, margin, orientationSelect.value);
    lastPdfUrl = URL.createObjectURL(pdf);
    downloadLink.href = lastPdfUrl;
    downloadLink.download = 'sborka-a4.pdf';
    downloadLink.hidden = false;
    setStatus(`Готово: ${pages.length} стр. формата A4`);
  } catch (err) {
    setStatus(`Ошибка: ${err.message}`);
  }
}

async function runExtract() {
  clearResults();
  hideDownload();
  try {
    let total = 0;
    for (let i = 0; i < pdfs.length; i++) {
      setStatus(`Разбор ${i + 1} из ${pdfs.length}…`);
      const { file } = pdfs[i];
      const bytes = new Uint8Array(await file.arrayBuffer());
      const base = file.name.replace(/\.pdf$/i, '');
      const found = extractJpegs(bytes);
      found.forEach((img, k) => {
        const blob = new Blob([img.bytes], { type: 'image/jpeg' });
        results.push({ name: `${base}-${k + 1}.jpg`, url: URL.createObjectURL(blob) });
      });
      total += found.length;
    }
    renderResults();
    setStatus(
      total > 0
        ? `Найдено изображений: ${total}`
        : 'Встроенных JPEG-изображений не найдено. Векторные чертежи и PDF с текстом не содержат готовых фото.'
    );
  } catch (err) {
    setStatus(`Ошибка: ${err.message}`);
  }
}

actionBtn.addEventListener('click', async () => {
  if (currentList().length === 0) return;
  actionBtn.disabled = true;
  try {
    if (mode === 'build') await runBuild();
    else await runExtract();
  } finally {
    actionBtn.disabled = currentList().length === 0;
  }
});

setMode('build');
