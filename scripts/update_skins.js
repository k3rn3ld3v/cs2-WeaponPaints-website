const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');

const API_BASE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api';
const LANGUAGES = [
  { code: 'en', file: 'en-skins.json' },
  { code: 'pt-BR', file: 'pt-BR-skins.json' },
  { code: 'ru', file: 'ru-skins.json' },
  { code: 'zh-CN', file: 'zh-CN-skins.json' },
];

const SKINS_DIR = path.join(__dirname, '..', 'web', 'public', 'js', 'json', 'skins');
const NUMERIC_ID_REGEX = /(\d+)/g;

const readJson = async (filePath, fallback = []) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
};

const writeJson = async (filePath, data) => {
  const content = ${JSON.stringify(data, null, 2)}\n;
  await fs.writeFile(filePath, content, 'utf8');
};

const buildIdMap = (items) => {
  const map = new Map();
  let maxNumericId = 0;

  for (const item of items) {
    const key = buildKey(item.weapon?.id, item.paint_index);
    map.set(key, item.id);

    const matches = String(item.id).match(NUMERIC_ID_REGEX);
    if (matches) {
      for (const segment of matches) {
        const value = Number(segment);
        if (!Number.isNaN(value)) {
          maxNumericId = Math.max(maxNumericId, value);
        }
      }
    }
  }

  return { map, maxNumericId };
};

const buildKey = (weaponId, paintIndex) => {
  const weaponKey = weaponId ? String(weaponId) : '';
  const paintKey = paintIndex == null ? 'null' : String(paintIndex);
  return ${weaponKey}::;
};

const sanitizeItem = (item) => {
  const clone = JSON.parse(JSON.stringify(item));

  clone.weapon = {
    id: clone.weapon?.id ?? null,
    name: clone.weapon?.name ?? null,
  };

  if (clone.paint_index === '' || clone.paint_index === 'null') {
    clone.paint_index = null;
  }

  if (clone.paint_index != null) {
    clone.paint_index = String(clone.paint_index);
  }

  delete clone.legacy_model;

  return clone;
};

const sortItems = (items) => {
  const numericOrMax = (value) => {
    if (value == null) return -1;
    const number = Number(value);
    if (!Number.isNaN(number)) {
      return number;
    }
    return Number.MAX_SAFE_INTEGER;
  };

  return items.slice().sort((a, b) => {
    const weaponA = a.weapon?.id ?? '';
    const weaponB = b.weapon?.id ?? '';
    if (weaponA < weaponB) return -1;
    if (weaponA > weaponB) return 1;

    const paintDiff = numericOrMax(a.paint_index) - numericOrMax(b.paint_index);
    if (paintDiff !== 0) return paintDiff;

    const paintA = a.paint_index ?? '';
    const paintB = b.paint_index ?? '';
    if (paintA < paintB) return -1;
    if (paintA > paintB) return 1;

    const nameA = a.name ?? '';
    const nameB = b.name ?? '';
    return nameA.localeCompare(nameB);
  });
};

const fetchSkins = async (langCode) => {
  const url = ${API_BASE}//skins.json;
  const response = await axios.get(url, { timeout: 30000 });
  return response.data;
};

const updateLanguage = (lang, idMap, currentMaxId) => async () => {
  const rawItems = await fetchSkins(lang.code);
  let localMaxId = currentMaxId;
  const updatedItems = [];

  for (const rawItem of rawItems) {
    const item = sanitizeItem(rawItem);
    const key = buildKey(item.weapon.id, item.paint_index);

    let itemId = idMap.get(key);
    if (!itemId) {
      localMaxId += 1;
      itemId = skin-;
      idMap.set(key, itemId);
    }

    item.id = itemId;
    updatedItems.push(item);
  }

  const sorted = sortItems(updatedItems);
  const outputPath = path.join(SKINS_DIR, lang.file);
  await writeJson(outputPath, sorted);

  return localMaxId;
};

const run = async () => {
  const existingEnPath = path.join(SKINS_DIR, 'en-skins.json');
  const existingEn = await readJson(existingEnPath, []);
  const { map: idMap, maxNumericId } = buildIdMap(existingEn);

  let maxId = maxNumericId;
  for (const lang of LANGUAGES) {
    maxId = await updateLanguage(lang, idMap, maxId)();
  }
};

run()
  .then(() => {
    console.log('Skins data updated successfully.');
  })
  .catch((error) => {
    console.error('Failed to update skins data:', error.message ?? error);
    process.exitCode = 1;
  });
