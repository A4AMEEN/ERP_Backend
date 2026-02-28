const mongoose = require('mongoose');

const StatsSchema = new mongoose.Schema({
    totalMatches: { type: Number, default: 0 },
    totalGoals: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    penaltyGoals: { type: Number, default: 0 },
    freekickGoals: { type: Number, default: 0 },
    cornerGoals: { type: Number, default: 0 },
    ownGoals: { type: Number, default: 0 }
}, { _id: false });

const PlayerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    stats: { type: StatsSchema, default: () => ({}) },
    concededMatches: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Player', PlayerSchema);