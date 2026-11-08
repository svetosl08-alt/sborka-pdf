import { buildPdf } from './pdf.js';

const MAX_SIDE = 2400; // ограничение стороны изображения в пикселях, чтобы PDF не был слишком большим

const fileInput = document.getElementById('fileInput');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const marginInput = document.getElementById('margin');
const buildBtn = document.getElementById('build');
const statusEl = document.getElementById('status');
const downloadLink = document.getElementById('download');

/** @type {{file: File, url: string}[]} */
const items = [];
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

function render() {
  list.innerHTML = '';
  items.forEach((item, index) => {
    const li = document.createElement('li');

    const thumb = document.createElement('img');
    thumb.className = 'thumb';
    thumb.src = item.url;
    thumb.alt = '';

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = item.file.name;
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = `Страница ${index + 1}`;
    info.append(name, num);

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      makeBtn('↑', 'Переместить выше', index === 0, () => move(index, -1)),
      makeBtn('↓', 'Переместить ниже', index === items.length - 1, () => move(index, 1)),
      makeBtn('✕', 'Удалить', false, () => remove(index), true)
    );

    li.append(thumb, info, actions);
    list.appendChild(li);
  });

  empty.hidden = items.length > 0;
  buildBtn.disabled = items.length === 0;
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
  if (target < 0 || target >= items.length) return;
  [items[index], items[target]] = [items[target], items[index]];
  hideDownload();
  render();
}

function remove(index) {
  URL.revokeObjectURL(items[index].url);
  items.splice(index, 1);
  hideDownload();
  setStatus('');
  render();
}

fileInput.addEventListener('change', () => {
  for (const file of fileInput.files) {
    if (!/^image\/(png|jpeg)$/.test(file.type)) continue;
    items.push({ file, url: URL.createObjectURL(file) });
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

buildBtn.addEventListener('click', async () => {
  if (items.length === 0) return;
  buildBtn.disabled = true;
  hideDownload();
  try {
    const images = [];
    for (let i = 0; i < items.length; i++) {
      setStatus(`Обработка ${i + 1} из ${items.length}…`);
      images.push(await toJpeg(items[i].url));
    }
    const margin = Math.min(50, Math.max(0, Number(marginInput.value) || 0));
    const pdf = buildPdf(images, margin);
    lastPdfUrl = URL.createObjectURL(pdf);
    downloadLink.href = lastPdfUrl;
    downloadLink.download = 'sborka-a4.pdf';
    downloadLink.hidden = false;
    setStatus(`Готово: ${images.length} стр. формата A4`);
  } catch (err) {
    setStatus(`Ошибка: ${err.message}`);
  } finally {
    buildBtn.disabled = items.length === 0;
  }
});

render();