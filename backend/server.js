const express = require('express');
const cors    = require('cors');
const pool    = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/trending', async (req, res) => {
  try {
    const regionId = req.query.region_id;
    let query;
    let params;

    if (regionId) {
      query = `
        SELECT
          m.music_id,
          m.title,
          m.artist,
          m.music_genre,
          m.music_platform,
          t.popularity_score AS avg_score,
          1 AS region_count,
          t.recorded_at
        FROM MUSIC m
        JOIN REGION_MUSIC_TREND t ON m.music_id = t.music_id
        WHERE t.region_id = ?
        ORDER BY t.popularity_score DESC
      `;
      params = [regionId];
    } else {
      query = `
        SELECT
          m.music_id,
          m.title,
          m.artist,
          m.music_genre,
          m.music_platform,
          AVG(t.popularity_score) AS avg_score,
          COUNT(t.trend_id)       AS region_count
        FROM MUSIC m
        JOIN REGION_MUSIC_TREND t ON m.music_id = t.music_id
        GROUP BY m.music_id, m.title, m.artist, m.music_genre, m.music_platform
        ORDER BY avg_score DESC
        LIMIT 20
      `;
      params = [];
    }

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch trending songs' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    const term = '%' + q.trim() + '%';
    const [rows] = await pool.execute(
      `SELECT
         m.music_id,
         m.title,
         m.artist,
         m.music_genre,
         m.music_platform,
         AVG(t.popularity_score) AS avg_score,
         COUNT(t.trend_id)       AS region_count
       FROM MUSIC m
       LEFT JOIN REGION_MUSIC_TREND t ON m.music_id = t.music_id
       WHERE m.title LIKE ? OR m.artist LIKE ? OR m.music_genre LIKE ?
       GROUP BY m.music_id, m.title, m.artist, m.music_genre, m.music_platform
       ORDER BY avg_score DESC`,
      [term, term, term]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/regions', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT region_id, region_name, region_platforms FROM REGION ORDER BY region_name'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

app.get('/api/map', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         r.region_name,
         m.music_platform,
         m.title,
         AVG(t.popularity_score) AS avg_score
       FROM REGION_MUSIC_TREND t
       JOIN REGION r ON t.region_id = r.region_id
       JOIN MUSIC  m ON t.music_id  = m.music_id
       GROUP BY r.region_name, m.music_platform, m.title
       ORDER BY avg_score DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

app.get('/api/songs/:id/detail', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         r.region_name,
         a.age_range,
         t.popularity_score,
         t.recorded_at
       FROM REGION_MUSIC_TREND t
       JOIN REGION    r ON t.region_id    = r.region_id
       JOIN AGE_GROUP a ON t.age_group_id = a.age_group_id
       WHERE t.music_id = ?
       ORDER BY t.popularity_score DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch song detail' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const [[songs]]   = await pool.execute('SELECT COUNT(*) AS count FROM MUSIC');
    const [[regions]] = await pool.execute('SELECT COUNT(*) AS count FROM REGION');
    const [[trends]]  = await pool.execute('SELECT COUNT(*) AS count FROM REGION_MUSIC_TREND');
    const [[platforms]] = await pool.execute('SELECT COUNT(DISTINCT music_platform) AS count FROM MUSIC');
    res.json({
      songs:     songs.count,
      regions:   regions.count,
      trends:    trends.count,
      platforms: platforms.count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.post('/api/survey', async (req, res) => {
  try {
    const answers = req.body;
    const activities = Object.values(answers).join(',');
    await pool.execute(
      'INSERT INTO USER (user_activities) VALUES (?)',
      [activities]
    );
    res.json({ status: 'saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save survey' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('Music Trends backend running at http://localhost:' + PORT);
});
