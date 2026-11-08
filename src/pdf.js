// Минимальный генератор PDF: каждое изображение (JPEG) на отдельной странице A4.

// A4 альбомной ориентации, пункты (1 пт = 1/72 дюйма)
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const enc = new TextEncoder();

/**
 * @param {{bytes: Uint8Array, width: number, height: number}[]} images JPEG-данные и размеры в пикселях
 * @param {number} marginMm поля в миллиметрах
 * @returns {Blob} PDF-файл
 */
export function buildPdf(images, marginMm = 10) {
  const margin = (marginMm * 72) / 25.4;
  const n = images.length;
  const chunks = [];
  const offsets = [];
  let offset = 0;

  const push = (data) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes);
    offset += bytes.length;
  };

  const writeObj = (id, body) => {
    offsets[id] = offset;
    push(`${id} 0 obj\n${body}\nendobj\n`);
  };

  const writeStreamObj = (id, dict, data) => {
    offsets[id] = offset;
    push(`${id} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`);
    push(data);
    push('\nendstream\nendobj\n');
  };

  // Заголовок с байтами «бинарного» комментария
  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // 1 — каталог, 2 — список страниц
  writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = [];
  for (let i = 0; i < n; i++) kids.push(3 + 3 * i);
  writeObj(2, `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${n} >>`);

  for (let i = 0; i < n; i++) {
    const pageId = 3 + 3 * i;
    const contentId = 4 + 3 * i;
    const imageId = 5 + 3 * i;
    const { bytes, width: w, height: h } = images[i];

    // Вписываем изображение с сохранением пропорций и центрируем
    const scale = Math.min((PAGE_W - 2 * margin) / w, (PAGE_H - 2 * margin) / h);
    const dw = w * scale;
    const dh = h * scale;
    const x = (PAGE_W - dw) / 2;
    const y = (PAGE_H - dh) / 2;

    writeObj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /XObject << /Im${i} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );

    const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`;
    writeStreamObj(contentId, '', enc.encode(content));

    writeStreamObj(
      imageId,
      `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      bytes
    );
  }

  // Таблица перекрёстных ссылок
  const size = 3 * n + 3;
  const xrefPos = offset;
  push(`xref\n0 ${size}\n`);
  push('0000000000 65535 f \n');
  for (let id = 1; id < size; id++) {
    push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob(chunks, { type: 'application/pdf' });
}