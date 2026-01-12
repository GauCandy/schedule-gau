const fs = require('fs/promises');
const path = require('path');
const sqlite3 = require('sqlite3');

const exec = (db, sql) =>
  new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });

async function initSchema(options = {}) {
  const dbPath =
    options.dbPath || path.join(__dirname, 'db', 'database.sqlite');
  const schemaPath =
    options.schemaPath || path.join(__dirname, 'db', 'schrema.sql');

  const schemaSql = await fs.readFile(schemaPath, 'utf8');
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  const db = await new Promise((resolve, reject) => {
    const instance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(instance);
      }
    });
  });

  try {
    await exec(db, 'PRAGMA foreign_keys = ON;');
    await exec(db, schemaSql);
  } finally {
    await new Promise((resolve, reject) => {
      db.close((err) => (err ? reject(err) : resolve()));
    });
  }

  return { dbPath, schemaPath };
}

module.exports = { initSchema };
