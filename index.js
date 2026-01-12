const http = require('http');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { initSchema } = require('./initSchema');

require('dotenv').config();

const ASSET_VERSION = process.env.ASSET_VERSION || Date.now().toString();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const PUBLIC_DIR = path.join(__dirname, 'public');
let db;

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function hashPassword(password) {
  if (!password) return null;
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split('/').filter(Boolean);

  if (url.pathname === '/api/classes') {
    if (req.method === 'GET') {
      try {
        const rows = await dbAll(
          `SELECT uid, class_name,
                  CASE
                    WHEN password_hash IS NOT NULL AND password_hash <> '' THEN 1
                    ELSE 0
                  END AS has_password
           FROM classes
           ORDER BY created_at DESC`
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: rows }));
      } catch (err) {
        console.error('List classes error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
      return true;
    }

    if (req.method === 'POST') {
      try {
        const body = await parseJson(req);
        const className = (body.class_name || '').trim();
        const password = (body.password || '').trim();

        if (!className) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Tên lớp không được để trống' }));
          return true;
        }

        const now = new Date();
        const baseDate = now.toISOString().slice(0, 10);
        const baseWeek = 1;
        const passwordHash = hashPassword(password);

        await dbRun(
          `INSERT INTO classes (class_name, password_hash, base_date, base_week)
           VALUES (?, ?, ?, ?)`,
          [className, passwordHash, baseDate, baseWeek]
        );

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            data: {
              class_name: className,
            },
          })
        );
      } catch (err) {
        if (err && err.message && err.message.includes('UNIQUE')) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Lớp đã tồn tại' }));
          return true;
        }
        if (err && err.message === 'Payload too large') {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload quá lớn' }));
          return true;
        }
        if (err instanceof SyntaxError) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'JSON không hợp lệ' }));
          return true;
        }
        console.error('Create class error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
      return true;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return true;
  }

  if (segments[0] === 'api' && segments[1] === 'classes' && segments[2]) {
    const classId = segments[2];

    if (req.method === 'GET' && segments.length === 3) {
      try {
        const row = await dbGet(
          `SELECT uid, class_name, base_date, base_week,
                  CASE
                    WHEN password_hash IS NOT NULL AND password_hash <> '' THEN 1
                    ELSE 0
                  END AS has_password
           FROM classes
           WHERE uid = ?`,
          [classId]
        );
        if (!row) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Không tìm thấy lớp' }));
          return true;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: row }));
      } catch (err) {
        console.error('Get class error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
      return true;
    }

    if (req.method === 'PATCH' && segments[3] === 'base') {
      try {
        const body = await parseJson(req);
        const baseDate = (body.base_date || '').trim();
        const baseWeek = Number(body.base_week);
        const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoRegex.test(baseDate)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'base_date không hợp lệ (YYYY-MM-DD)' }));
          return true;
        }
        if (!Number.isInteger(baseWeek) || baseWeek < 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'base_week phải là số nguyên >= 1' }));
          return true;
        }

        const existing = await dbGet(
          'SELECT uid FROM classes WHERE uid = ?',
          [classId]
        );
        if (!existing) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Không tìm thấy lớp' }));
          return true;
        }

        await dbRun(
          'UPDATE classes SET base_date = ?, base_week = ? WHERE uid = ?',
          [baseDate, baseWeek, classId]
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: { base_date: baseDate, base_week: baseWeek } }));
      } catch (err) {
        if (err instanceof SyntaxError) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'JSON không hợp lệ' }));
          return true;
        }
        console.error('Update base info error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
      return true;
    }

    if (req.method === 'GET' && segments[3] === 'subjects') {
      const week = Number(url.searchParams.get('week') || 0);
      const includeUpcoming =
        url.searchParams.get('include_upcoming') === '1' ||
        url.searchParams.get('include_upcoming') === 'true';
      if (!Number.isInteger(week) || week < 1) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'week phải là số nguyên >= 1' }));
        return true;
      }
      try {
        // Current week matches
        const currentRows = await dbAll(
          `SELECT id, subject_name, teacher, room, start_week, end_week, day_of_week, is_morning, off_weeks, created_at
           FROM subjects
           WHERE class_uid = ? AND start_week <= ? AND end_week >= ?
           ORDER BY id DESC`,
          [classId, week, week]
        );

        const filterOffWeeks = (row) => {
          if (!row.off_weeks) return true;
          const list = row.off_weeks
            .split(',')
            .map((v) => Number(v.trim()))
            .filter((v) => Number.isInteger(v) && v >= 1);
          return !list.includes(week);
        };

        const filteredCurrent = currentRows.filter(filterOffWeeks);

        // Keep latest per slot for current week
        const map = {};
        for (const row of filteredCurrent) {
          const key = `${row.day_of_week}-${row.is_morning}`;
          if (!map[key]) map[key] = row;
        }

        if (includeUpcoming) {
          const upcomingRows = await dbAll(
            `SELECT id, subject_name, teacher, room, start_week, end_week, day_of_week, is_morning, off_weeks, created_at
             FROM subjects
             WHERE class_uid = ? AND start_week > ?
             ORDER BY start_week ASC, id DESC`,
            [classId, week]
          );
          const bySlotUpcoming = {};
          for (const row of upcomingRows) {
            const key = `${row.day_of_week}-${row.is_morning}`;
            if (!bySlotUpcoming[key]) bySlotUpcoming[key] = row;
          }
          for (const [key, val] of Object.entries(bySlotUpcoming)) {
            if (!map[key]) {
              map[key] = { ...val, upcoming: true };
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: Object.values(map) }));
      } catch (err) {
        console.error('List subjects error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
      return true;
    }

    if (req.method === 'POST' && segments[3] === 'subjects') {
      try {
        const body = await parseJson(req);
        const subjectName = (body.subject_name || '').trim();
        const teacher = (body.teacher || '').trim();
        const room = (body.room || '').trim();
        const startWeek = Number(body.start_week);
        const endWeek = Number(body.end_week);
        const dayOfWeek = Number(body.day_of_week);
        const isMorning = Number(body.is_morning);
        const offWeeks = (body.off_weeks || '').trim();

        if (!subjectName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Tên môn học không được trống' }));
          return true;
        }
        if (!Number.isInteger(startWeek) || startWeek < 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'start_week phải là số nguyên >= 1' }));
          return true;
        }
        if (!Number.isInteger(endWeek) || endWeek < startWeek) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ error: 'end_week phải >= start_week và là số nguyên' })
          );
          return true;
        }
        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'day_of_week phải trong khoảng 1-7' }));
          return true;
        }
        if (isMorning !== 0 && isMorning !== 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'is_morning phải là 0 hoặc 1' }));
          return true;
        }

        const existingClass = await dbGet('SELECT uid FROM classes WHERE uid = ?', [
          classId,
        ]);
        if (!existingClass) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Không tìm thấy lớp' }));
          return true;
        }

        const { lastID } = await dbRun(
          `INSERT INTO subjects
            (subject_name, teacher, room, class_uid, start_week, end_week, day_of_week, is_morning, off_weeks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            subjectName,
            teacher || null,
            room || null,
            classId,
            startWeek,
            endWeek,
            dayOfWeek,
            isMorning,
            offWeeks || null,
          ]
        );

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            data: {
              id: lastID,
              subject_name: subjectName,
            },
          })
        );
      } catch (err) {
        if (err && err.message === 'Payload too large') {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload quá lớn' }));
          return true;
        }
        if (err instanceof SyntaxError) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'JSON không hợp lệ' }));
          return true;
        }
        console.error('Create subject error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
      return true;
    }

    if (req.method === 'PATCH' && segments[3] === 'subjects' && segments[4]) {
      const subjectId = segments[4];
      try {
        const body = await parseJson(req);
        const subjectName = (body.subject_name || '').trim();
        const teacher = (body.teacher || '').trim();
        const room = (body.room || '').trim();
        const startWeek = Number(body.start_week);
        const endWeek = Number(body.end_week);
        const dayOfWeek = Number(body.day_of_week);
        const isMorning = Number(body.is_morning);
        const offWeeks = (body.off_weeks || '').trim();

        if (!subjectName) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Tên môn học không được trống' }));
          return true;
        }
        if (!Number.isInteger(startWeek) || startWeek < 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'start_week phải là số nguyên >= 1' }));
          return true;
        }
        if (!Number.isInteger(endWeek) || endWeek < startWeek) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ error: 'end_week phải >= start_week và là số nguyên' })
          );
          return true;
        }
        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'day_of_week phải trong khoảng 1-7' }));
          return true;
        }
        if (isMorning !== 0 && isMorning !== 1) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'is_morning phải là 0 hoặc 1' }));
          return true;
        }

        const row = await dbGet(
          'SELECT id FROM subjects WHERE id = ? AND class_uid = ?',
          [subjectId, classId]
        );
        if (!row) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Không tìm thấy môn học' }));
          return true;
        }

        await dbRun(
          `UPDATE subjects
           SET subject_name = ?, teacher = ?, room = ?, start_week = ?, end_week = ?, day_of_week = ?, is_morning = ?, off_weeks = ?
           WHERE id = ?`,
          [
            subjectName,
            teacher || null,
            room || null,
            startWeek,
            endWeek,
            dayOfWeek,
            isMorning,
            offWeeks || null,
            subjectId,
          ]
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: { id: subjectId } }));
      } catch (err) {
        if (err instanceof SyntaxError) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'JSON không hợp lệ' }));
          return true;
        }
        console.error('Update subject error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
      return true;
    }
  }

  if (segments[0] === 'api' && segments[1] === 'classes' && segments[3] === 'verify') {
    const classId = segments[2];
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return true;
    }
    try {
      const body = await parseJson(req);
      const password = (body.password || '').trim();
      if (!password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Mật khẩu không được trống' }));
        return true;
      }

      const row = await dbGet(
        'SELECT password_hash FROM classes WHERE uid = ?',
        [classId]
      );
      if (!row) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Không tìm thấy lớp' }));
        return true;
      }

      const passwordHash = hashPassword(password);
      if (!row.password_hash) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Lớp này không yêu cầu mật khẩu' }));
        return true;
      }

      if (row.password_hash === passwordHash) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: true }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Mật khẩu không đúng' }));
      }
    } catch (err) {
      console.error('Verify password error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Server error' }));
    }
    return true;
  }

  return false;
}

async function serveStatic(req, res) {
  const urlPath = req.url.split('?')[0] || '/';
  const safePath = path.normalize(urlPath === '/' ? '/index.html' : urlPath);
  const requestedPath = path.join(PUBLIC_DIR, safePath);
  const resolvedPath = path.resolve(requestedPath);

  if (!resolvedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    let data = await fs.readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();

    if (ext === '.html') {
      const text = data.toString('utf8').replace(/__ASSET_VERSION__/g, ASSET_VERSION);
      data = Buffer.from(text, 'utf8');
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not found');
    } else {
      console.error('Static serve error:', err);
      res.writeHead(500);
      res.end('Server error');
    }
  }
}

function startServer(port) {
  const server = http.createServer(async (req, res) => {
    try {
      const handled = await handleApi(req, res);
      if (handled) return;

      if (req.method !== 'GET') {
        res.writeHead(405);
        res.end('Method Not Allowed');
        return;
      }

      serveStatic(req, res);
    } catch (err) {
      console.error('Request handling error:', err);
      res.writeHead(500);
      res.end('Server error');
    }
  });

  server.listen(port, () => {
    console.log(`Timetable UI available at http://localhost:${port}`);
  });
}

async function main() {
  const { dbPath, schemaPath } = await initSchema();
  db = new sqlite3.Database(dbPath);
  console.log(`Initialized schema from ${schemaPath} into ${dbPath}`);

  const port = process.env.PORT || 3000;
  startServer(port);
}

main().catch((err) => {
  console.error('Failed to start app:', err);
  process.exit(1);
});
