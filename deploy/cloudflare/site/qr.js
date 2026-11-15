/* ---------------------------------------------------------------------------
 * IhsanQR — a small, dependency-free QR Code encoder (byte mode, EC level M).
 * Supports versions 1..10 (up to 213 bytes), which covers the academy card
 * links. It renders crisp SVG so the printed codes stay sharp at any size.
 * No network calls, no external library, no data leaves the device.
 * ------------------------------------------------------------------------- */
(function (global) {
  "use strict";

  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function buildTables() {
    let x = 1;
    for (let i = 0; i < 255; i += 1) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
  })();

  function mul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i += 1) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j += 1) {
        next[j] ^= poly[j];
        next[j + 1] ^= mul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecCount) {
    const gen = rsGenerator(ecCount);
    const res = new Array(ecCount).fill(0);
    for (const byte of data) {
      const factor = byte ^ res[0];
      res.shift();
      res.push(0);
      for (let i = 0; i < ecCount; i += 1) res[i] ^= mul(gen[i + 1], factor);
    }
    return res;
  }

  // Error correction level M only: good balance for printed cards.
  const VERSIONS = [
    null,
    { v: 1, ec: 10, groups: [{ count: 1, data: 16 }] },
    { v: 2, ec: 16, groups: [{ count: 1, data: 28 }] },
    { v: 3, ec: 26, groups: [{ count: 1, data: 44 }] },
    { v: 4, ec: 18, groups: [{ count: 2, data: 32 }] },
    { v: 5, ec: 24, groups: [{ count: 2, data: 43 }] },
    { v: 6, ec: 16, groups: [{ count: 4, data: 27 }] },
    { v: 7, ec: 18, groups: [{ count: 4, data: 31 }] },
    { v: 8, ec: 22, groups: [{ count: 2, data: 38 }, { count: 2, data: 39 }] },
    { v: 9, ec: 22, groups: [{ count: 3, data: 36 }, { count: 2, data: 37 }] },
    { v: 10, ec: 26, groups: [{ count: 4, data: 43 }, { count: 1, data: 44 }] }
  ];

  const ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function utf8Bytes(text) {
    return Array.from(new TextEncoder().encode(String(text)));
  }

  function dataCapacity(info) {
    return info.groups.reduce((sum, group) => sum + group.count * group.data, 0);
  }

  function pickVersion(byteLength) {
    for (let v = 1; v < VERSIONS.length; v += 1) {
      const info = VERSIONS[v];
      const headerBits = 4 + (v <= 9 ? 8 : 16);
      if (headerBits + byteLength * 8 <= dataCapacity(info) * 8) return info;
    }
    throw new Error("qr_too_long");
  }

  function encodeData(bytes, info) {
    const capacity = dataCapacity(info);
    const bits = [];
    const push = (value, length) => {
      for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
    };
    push(4, 4); // byte mode
    push(bytes.length, info.v <= 9 ? 8 : 16);
    for (const byte of bytes) push(byte, 8);
    const capacityBits = capacity * 8;
    for (let i = 0; i < 4 && bits.length < capacityBits; i += 1) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
      data.push(byte);
    }
    const pads = [0xec, 0x11];
    let pad = 0;
    while (data.length < capacity) data.push(pads[pad++ % 2]);
    return data;
  }

  function buildCodewords(data, info) {
    const blocks = [];
    let offset = 0;
    for (const group of info.groups) {
      for (let i = 0; i < group.count; i += 1) {
        const blockData = data.slice(offset, offset + group.data);
        offset += group.data;
        blocks.push({ data: blockData, ec: rsEncode(blockData, info.ec) });
      }
    }
    const maxData = blocks.reduce((max, block) => Math.max(max, block.data.length), 0);
    const out = [];
    for (let i = 0; i < maxData; i += 1) {
      for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
    }
    for (let i = 0; i < info.ec; i += 1) {
      for (const block of blocks) out.push(block.ec[i]);
    }
    return out;
  }

  function formatBits(mask) {
    // EC level M = 00, mask pattern 0..7.
    const data = (0 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }

  function versionBits(version) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (version << 12) | rem;
  }

  function buildMatrix(version, codewords) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (row, col, value) => {
      if (row < 0 || row >= size || col < 0 || col >= size) return;
      modules[row][col] = Boolean(value);
      reserved[row][col] = true;
    };

    const finder = (row, col) => {
      for (let dr = -1; dr <= 7; dr += 1) {
        for (let dc = -1; dc <= 7; dc += 1) {
          const inner = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          const dark = inner && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
          set(row + dr, col + dc, dark);
        }
      }
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    for (let i = 8; i < size - 8; i += 1) {
      const dark = i % 2 === 0;
      if (!reserved[6][i]) set(6, i, dark);
      if (!reserved[i][6]) set(i, 6, dark);
    }

    for (const row of ALIGN[version] || []) {
      for (const col of ALIGN[version] || []) {
        if ((row === 6 && col === 6) || (row === 6 && col === size - 7) || (row === size - 7 && col === 6)) continue;
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            set(row + dr, col + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }

    // Reserve format information areas before data placement.
    for (let i = 0; i < 9; i += 1) {
      if (!reserved[8][i]) set(8, i, false);
      if (!reserved[i][8]) set(i, 8, false);
    }
    for (let i = 0; i < 8; i += 1) {
      if (!reserved[8][size - 1 - i]) set(8, size - 1 - i, false);
      if (!reserved[size - 1 - i][8]) set(size - 1 - i, 8, false);
    }
    // Dark module.
    set(size - 8, 8, true);

    if (version >= 7) {
      const bits = versionBits(version);
      for (let i = 0; i < 18; i += 1) {
        const dark = ((bits >>> i) & 1) === 1;
        const row = Math.floor(i / 3);
        const col = i % 3;
        set(row, size - 11 + col, dark);
        set(size - 11 + col, row, dark);
      }
    }

    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert += 1) {
        for (let j = 0; j < 2; j += 1) {
          const col = right - j;
          const upward = ((right + 1) & 2) === 0;
          const row = upward ? size - 1 - vert : vert;
          if (reserved[row][col]) continue;
          const dark = bitIndex < codewords.length * 8
            ? ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1
            : false;
          modules[row][col] = dark;
          bitIndex += 1;
        }
      }
    }

    // Mask pattern 0: (row + col) % 2 === 0.
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!reserved[row][col] && (row + col) % 2 === 0) modules[row][col] = !modules[row][col];
      }
    }

    const bits = formatBits(0);
    for (let i = 0; i <= 5; i += 1) modules[i][8] = ((bits >>> i) & 1) === 1;
    modules[7][8] = ((bits >>> 6) & 1) === 1;
    modules[8][8] = ((bits >>> 7) & 1) === 1;
    modules[8][7] = ((bits >>> 8) & 1) === 1;
    for (let i = 9; i < 15; i += 1) modules[8][14 - i] = ((bits >>> i) & 1) === 1;
    for (let i = 0; i < 8; i += 1) modules[8][size - 1 - i] = ((bits >>> i) & 1) === 1;
    for (let i = 8; i < 15; i += 1) modules[size - 15 + i][8] = ((bits >>> i) & 1) === 1;

    return modules;
  }

  function matrix(text) {
    const bytes = utf8Bytes(text);
    const info = pickVersion(bytes.length);
    const codewords = buildCodewords(encodeData(bytes, info), info);
    return buildMatrix(info.v, codewords);
  }

  function svg(text, options) {
    const opts = options || {};
    const modules = matrix(text);
    const count = modules.length;
    const margin = opts.margin === undefined ? 4 : Number(opts.margin);
    const dimension = count + margin * 2;
    const size = opts.size ? Number(opts.size) : 0;
    const dark = opts.dark || "#0b1f17";
    const light = opts.light || "#ffffff";
    let path = "";
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (modules[row][col]) path += "M" + (col + margin) + "," + (row + margin) + "h1v1h-1z";
      }
    }
    const sizeAttrs = size ? ' width="' + size + '" height="' + size + '"' : "";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dimension + " " + dimension + '"' + sizeAttrs + ' role="img" aria-label="QR" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="' + light + '"/><path d="' + path + '" fill="' + dark + '"/></svg>';
  }

  function dataUrl(text, options) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(text, options));
  }

  global.IhsanQR = { matrix: matrix, svg: svg, dataUrl: dataUrl, version: "1.0.0" };
})(typeof window !== "undefined" ? window : globalThis);
