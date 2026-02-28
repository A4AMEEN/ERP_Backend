const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Player = require('./player');
const Match = require('./match');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('MongoDB connected');
    await seedPlayers();
}).catch(err => console.error('MongoDB error:', err));

// ─── Seed players if none exist ──────────────────────────────────────────────
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
        console.log('Seeded Shakthi and Shynu');
    } else {
        console.log(`Found ${count} existing player(s) — skipping seed`);
    }
}

// ─── Helper: build $inc objects ──────────────────────────────────────────────
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
        'stats.totalGoals': myEffective * m,
        'stats.penaltyGoals': me_penaltyGoals * m,
        'stats.freekickGoals': me_freekickGoals * m,
        'stats.cornerGoals': me_cornerGoals * m,
        'stats.ownGoals': me_ownGoals * m,
    };
    if (result === 'win') meInc['stats.wins'] = 1 * m;
    if (result === 'draw') meInc['stats.draws'] = 1 * m;
    if (result === 'loss') meInc['stats.losses'] = 1 * m;
    if (friendEffective > 0) meInc['concededMatches'] = 1 * m;

    const friendInc = {
        'stats.totalMatches': 1 * m,
        'stats.totalGoals': friendEffective * m,
        'stats.penaltyGoals': friend_penaltyGoals * m,
        'stats.freekickGoals': friend_freekickGoals * m,
        'stats.cornerGoals': friend_cornerGoals * m,
        'stats.ownGoals': friend_ownGoals * m,
    };
    if (result === 'loss') friendInc['stats.wins'] = 1 * m;
    if (result === 'draw') friendInc['stats.draws'] = 1 * m;
    if (result === 'win') friendInc['stats.losses'] = 1 * m;
    if (myEffective > 0) friendInc['concededMatches'] = 1 * m;

    return { meInc, friendInc };
}

// ─── GET /api/players ────────────────────────────────────────────────────────
app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find();
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

// ─── GET /api/history  — fetch all match history (newest first) ──────────────
app.get('/api/history', async (req, res) => {
    try {
        const matches = await Match.find().sort({ createdAt: -1 });
        res.json(matches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/matches  — add match, save to history, update player stats ────
app.post('/api/matches', async (req, res) => {
    try {
        const { meInc, friendInc } = buildIncrements(req.body, 1);

        // Save match history record to DB
        const savedMatch = await Match.create({
            matchDate: req.body.matchDate,
            result: req.body.result,
            me_normalGoals: req.body.me_normalGoals || 0,
            me_penaltyGoals: req.body.me_penaltyGoals || 0,
            me_freekickGoals: req.body.me_freekickGoals || 0,
            me_cornerGoals: req.body.me_cornerGoals || 0,
            me_ownGoals: req.body.me_ownGoals || 0,
            friend_normalGoals: req.body.friend_normalGoals || 0,
            friend_penaltyGoals: req.body.friend_penaltyGoals || 0,
            friend_freekickGoals: req.body.friend_freekickGoals || 0,
            friend_cornerGoals: req.body.friend_cornerGoals || 0,
            friend_ownGoals: req.body.friend_ownGoals || 0,
        });

        // Update player stats
        const [updatedMe, updatedFriend] = await Promise.all([
            Player.findOneAndUpdate({ name: 'Shakthi' }, { $inc: meInc }, { new: true }),
            Player.findOneAndUpdate({ name: 'Shynu' }, { $inc: friendInc }, { new: true })
        ]);

        res.json({ me: updatedMe, friend: updatedFriend, match: savedMatch });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/matches/reverse  — undo a match by its _id ───────────────────
app.post('/api/matches/reverse', async (req, res) => {
    try {
        const { meInc, friendInc } = buildIncrements(req.body, -1);

        const ops = [
            Player.findOneAndUpdate({ name: 'Shakthi' }, { $inc: meInc }, { new: true }),
            Player.findOneAndUpdate({ name: 'Shynu' }, { $inc: friendInc }, { new: true }),
        ];

        // If an _id was sent, delete that history record from DB
        if (req.body._id) {
            ops.push(Match.findByIdAndDelete(req.body._id));
        }

        const [updatedMe, updatedFriend] = await Promise.all(ops);
        res.json({ me: updatedMe, friend: updatedFriend });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/matches/:id  — update an existing match record ─────────────────
app.put('/api/matches/:id', async (req, res) => {
    try {
        const updated = await Match.findByIdAndUpdate(
            req.params.id,
            {
                matchDate: req.body.matchDate,
                result: req.body.result,
                me_normalGoals: req.body.me_normalGoals || 0,
                me_penaltyGoals: req.body.me_penaltyGoals || 0,
                me_freekickGoals: req.body.me_freekickGoals || 0,
                me_cornerGoals: req.body.me_cornerGoals || 0,
                me_ownGoals: req.body.me_ownGoals || 0,
                friend_normalGoals: req.body.friend_normalGoals || 0,
                friend_penaltyGoals: req.body.friend_penaltyGoals || 0,
                friend_freekickGoals: req.body.friend_freekickGoals || 0,
                friend_cornerGoals: req.body.friend_cornerGoals || 0,
                friend_ownGoals: req.body.friend_ownGoals || 0,
            },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: 'Match not found' });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/reset  — wipe everything and start fresh ───────────────────────
// ⚠️  Remove after use!
app.get('/api/reset', async (req, res) => {
    try {
        await Player.deleteMany({});
        await Match.deleteMany({});

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
        res.json({ ok: true, message: 'Reset complete — all data cleared.', players });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));