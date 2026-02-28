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

async function seedPlayers() {
    const count = await Player.countDocuments();
    if (count === 0) {
        await Player.insertMany([
            {
                name: 'Shakthi',
                stats: {
                    totalMatches: 0,
                    totalGoals: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    penaltyGoals: 0,
                    freekickGoals: 0,
                    cornerGoals: 0,
                    ownGoals: 0
                },
                concededMatches: 0
            },
            {
                name: 'Shynu',
                stats: {
                    totalMatches: 0,
                    totalGoals: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    penaltyGoals: 0,
                    freekickGoals: 0,
                    cornerGoals: 0,
                    ownGoals: 0
                },
                concededMatches: 0
            }
        ]);
        console.log('Seeded Shakthi and Shynu with fresh stats');
    }
}

// GET all players
app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find();
        console.log(players);
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET player by name
app.get('/api/players/:name', async (req, res) => {
    try {
        const player = await Player.findOne({ name: req.params.name });
        if (!player) return res.status(404).json({ error: 'Player not found' });
        res.json(player);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update player stats
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

// PATCH increment specific stats
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

/**
 * POST /api/matches
 * Adds a match result and updates both players atomically.
 */
app.post('/api/matches', async (req, res) => {
    try {
        const {
            result,
            me_normalGoals = 0, me_penaltyGoals = 0, me_freekickGoals = 0, me_cornerGoals = 0, me_ownGoals = 0,
            friend_normalGoals = 0, friend_penaltyGoals = 0, friend_freekickGoals = 0, friend_cornerGoals = 0, friend_ownGoals = 0
        } = req.body;

        const myGoalsScored = me_normalGoals + me_penaltyGoals + me_freekickGoals + me_cornerGoals;
        const friendGoalsScored = friend_normalGoals + friend_penaltyGoals + friend_freekickGoals + friend_cornerGoals;
        const myEffective = myGoalsScored + friend_ownGoals;
        const friendEffective = friendGoalsScored + me_ownGoals;

        const meInc = {
            'stats.totalMatches': 1,
            'stats.totalGoals': myEffective,
            'stats.penaltyGoals': me_penaltyGoals,
            'stats.freekickGoals': me_freekickGoals,
            'stats.cornerGoals': me_cornerGoals,
            'stats.ownGoals': me_ownGoals,
        };
        if (result === 'win') meInc['stats.wins'] = 1;
        if (result === 'draw') meInc['stats.draws'] = 1;
        if (result === 'loss') meInc['stats.losses'] = 1;
        if (friendEffective > 0) meInc['concededMatches'] = 1;

        const friendInc = {
            'stats.totalMatches': 1,
            'stats.totalGoals': friendEffective,
            'stats.penaltyGoals': friend_penaltyGoals,
            'stats.freekickGoals': friend_freekickGoals,
            'stats.cornerGoals': friend_cornerGoals,
            'stats.ownGoals': friend_ownGoals,
        };
        if (result === 'loss') friendInc['stats.wins'] = 1;
        if (result === 'draw') friendInc['stats.draws'] = 1;
        if (result === 'win') friendInc['stats.losses'] = 1;
        if (myEffective > 0) friendInc['concededMatches'] = 1;

        const [updatedMe, updatedFriend] = await Promise.all([
            Player.findOneAndUpdate({ name: 'Shakthi' }, { $inc: meInc }, { new: true }),
            Player.findOneAndUpdate({ name: 'Shynu' }, { $inc: friendInc }, { new: true })
        ]);

        res.json({ me: updatedMe, friend: updatedFriend });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));