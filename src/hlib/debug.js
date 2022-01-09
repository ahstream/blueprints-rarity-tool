import fs from 'fs';

const path = require('path');

export function debugToFile(data, filename = 'debug', folder = null) {
  const filepath = path.resolve(folder ?? global.__datadir, `${filename}-${Date.now()}.json`);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

