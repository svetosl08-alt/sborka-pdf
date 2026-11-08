// Поиск встроенных JPEG-изображений (/DCTDecode) в PDF.
// Векторная графика и текст здесь не разбираются: только готовые JPEG-потоки.

function toLatin1(bytes) {
  // Побайтовое соответствие: индекс строки совпадает с индексом байта
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return out;
}

/**
 * @param {Uint8Array} bytes содержимое PDF-файла
 * @returns {{bytes: Uint8Array, width: number, height: number}[]} JPEG-данные изображений по порядку в файле
 */
export function extractJpegs(bytes) {
  const str = toLatin1(bytes);
  const found = [];
  let pos = 0;

  while (true) {
    const s = str.indexOf('stream', pos);
    if (s === -1) break;
    pos = s + 6;
    // Пропускаем слово endstream
    if (s >= 3 && str.slice(s - 3, s) === 'end') continue;

    const objStart = str.lastIndexOf('obj', s);
    if (objStart === -1) continue;
    const dict = str.slice(objStart, s);

    // Данные начинаются после «stream» и перевода строки (CRLF или LF)
    let start = s + 6;
    if (str[start] === '\r') start++;
    if (str[start] === '\n') start++;
    else continue;

    // Длина: прямое значение проверяем по слову endstream, иначе ищем endstream
    let end = -1;
    const lm = /\/Length\s+(\d+)(\s+\d+\s+R)?/.exec(dict);
    if (lm && !lm[2]) {
      const len = Number(lm[1]);
      if (/^\s*endstream/.test(str.slice(start + len, start + len + 20))) end = start + len;
    }
    if (end === -1) {
      end = str.indexOf('endstream', start);
      if (end === -1) break;
      while (end > start && (str[end - 1] === '\n' || str[end - 1] === '\r')) end--;
    }
    pos = end;

    if (!/\/Subtype\s*\/Image/.test(dict) || !/DCTDecode/.test(dict)) continue;

    const w = /\/Width\s+(\d+)/.exec(dict);
    const h = /\/Height\s+(\d+)/.exec(dict);
    found.push({
      bytes: bytes.subarray(start, end),
      width: w ? Number(w[1]) : 0,
      height: h ? Number(h[1]) : 0,
    });
  }

  return found;
}
