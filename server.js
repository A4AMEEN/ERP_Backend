const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Player = require('./player');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('MongoDB connected');
    await seedPlayers();
}).catch(err => console.error('MongoDB error:', err));

// ─── Seed: only if NO players exist at all ──────────────────────────────────
async function seedPlayers() {
    const count = await Player.countDocuments();
    if (count === 0) {
        await Player.insertMany([
            {
                name: 'Shakthi',
                stats: {
                    totalMatches: 0, totalGoals: 0, wins: 0, draws: 0, losses: 0,
                    penaltyGoals: 0, freekickGoals: 0, cornerGoals: 0, ownGoals: 0
                },
                concededMatches: 0
            },
            {
                name: 'Shynu',
                stats: {
                    totalMatches: 0, totalGoals: 0, wins: 0, draws: 0, losses: 0,
                    penaltyGoals: 0, freekickGoals: 0, cornerGoals: 0, ownGoals: 0
                },
                concededMatches: 0
            }
        ]);
        console.log('Seeded Shakthi and Shynu with fresh stats');
    } else {
        console.log(`Found ${count} existing player(s) — skipping seed`);
    }
}

// ─── Helper: build $inc objects from a match payload ────────────────────────
function buildIncrements(payload, multiplier = 1) {
    const {
        result,
        me_normalGoals = 0, me_penaltyGoals = 0, me_freekickGoals = 0,
        me_cornerGoals = 0, me_ownGoals = 0,
        friend_normalGoals = 0, friend_penaltyGoals = 0, friend_freekickGoals = 0,
        friend_cornerGoals = 0, friend_ownGoals = 0
    } = payload;

    const myEffective = me_normalGoals + me_penaltyGoals + me_freekickGoals + me_cornerGoals + friend_ownGoals;
    const friendEffective = friend_normalGoals + friend_penaltyGoals + friend_freekickGoals + friend_cornerGoals + me_ownGoals;
    const m = multiplier;

    const meInc = {
        'stats.totalMatches': 1 * m,
        'stats.totalGoals':   myEffective * m,
        'stats.penaltyGoals': me_penaltyGoals * m,
        'stats.freekickGoals': me_freekickGoals * m,
        'stats.cornerGoals':  me_cornerGoals * m,
        'stats.ownGoals':     me_ownGoals * m,
    };
    if (result === 'win')  meInc['stats.wins']   = 1 * m;
    if (result === 'draw') meInc['stats.draws']  = 1 * m;
    if (result === 'loss') meInc['stats.losses'] = 1 * m;
    if (friendEffective > 0) meInc['concededMatches'] = 1 * m;

    const friendInc = {
        'stats.totalMatches': 1 * m,
        'stats.totalGoals':   friendEffective * m,
        'stats.penaltyGoals': friend_penaltyGoals * m,
        'stats.freekickGoals': friend_freekickGoals * m,
        'stats.cornerGoals':  friend_cornerGoals * m,
        'stats.ownGoals':     friend_ownGoals * m,
    };
    if (result === 'loss') friendInc['stats.wins']   = 1 * m;
    if (result === 'draw') friendInc['stats.draws']  = 1 * m;
    if (result === 'win')  friendInc['stats.losses'] = 1 * m;
    if (myEffective > 0) friendInc['concededMatches'] = 1 * m;

    return { meInc, friendInc };
}

// ─── GET /api/players ────────────────────────────────────────────────────────
app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find();
        console.log('GET /api/players ->', players.map(p => ({ name: p.name, id: p._id })));
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/players/:name ──────────────────────────────────────────────────
app.get('/api/players/:name', async (req, res) => {
    try {
        const player = await Player.findOne({ name: req.params.name });
        if (!player) return res.status(404).json({ error: 'Player not found' });
        res.json(player);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/players/:name ──────────────────────────────────────────────────
app.put('/api/players/:name', async (req, res) => {
    try {
        const player = await Player.findOneAndUpdate(
            { name: req.params.name },
            { $set: req.body },
            { new: true, runValidators: true }
        );
        if (!player) return res.status(404).json({ error: 'Player not found' });
        res.json(player);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PATCH /api/players/:name/increment ─────────────────────────────────────
app.patch('/api/players/:name/increment', async (req, res) => {
    try {
        const updates = {};
        for (const [key, val] of Object.entries(req.body)) {
            updates[key] = val;
        }
        const player = await Player.findOneAndUpdate(
            { name: req.params.name },
            { $inc: updates },
            { new: true }
        );
        if (!player) return res.status(404).json({ error: 'Player not found' });
        res.json(player);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/matches ───────────────────────────────────────────────────────
app.post('/api/matches', async (req, res) => {
    try {
        const { meInc, friendInc } = buildIncrements(req.body, 1);
        const [updatedMe, updatedFriend] = await Promise.all([
            Player.findOneAndUpdate({ name: 'Shakthi' }, { $inc: meInc }, { new: true }),
            Player.findOneAndUpdate({ name: 'Shynu' },   { $inc: friendInc }, { new: true })
        ]);
        console.log('POST /api/matches -> updated', updatedMe?.name, updatedFriend?.name);
        res.json({ me: updatedMe, friend: updatedFriend });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/matches/reverse ───────────────────────────────────────────────
app.post('/api/matches/reverse', async (req, res) => {
    try {
        const { meInc, friendInc } = buildIncrements(req.body, -1);
        const [updatedMe, updatedFriend] = await Promise.all([
            Player.findOneAndUpdate({ name: 'Shakthi' }, { $inc: meInc }, { new: true }),
            Player.findOneAndUpdate({ name: 'Shynu' },   { $inc: friendInc }, { new: true })
        ]);
        res.json({ me: updatedMe, friend: updatedFriend });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/reset  (WIPE all stats + delete duplicates, keep only 1 doc per player) ──
// ⚠️  Remove this route after you've run it once!
app.get('/api/reset', async (req, res) => {
    try {
        // Delete ALL player documents first
        await Player.deleteMany({});

        // Re-create fresh ones
        await Player.insertMany([
            {
                name: 'Shakthi',
                stats: {
                    totalMatches: 0, totalGoals: 0, wins: 0, draws: 0, losses: 0,
                    penaltyGoals: 0, freekickGoals: 0, cornerGoals: 0, ownGoals: 0
                },
                concededMatches: 0
            },
            {
                name: 'Shynu',
                stats: {
                    totalMatches: 0, totalGoals: 0, wins: 0, draws: 0, losses: 0,
                    penaltyGoals: 0, freekickGoals: 0, cornerGoals: 0, ownGoals: 0
                },
                concededMatches: 0
            }
        ]);

        const players = await Player.find();
        console.log('RESET complete ->', players.map(p => ({ name: p.name, id: p._id })));
        res.json({ ok: true, message: 'All players deleted and re-created fresh.', players });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));