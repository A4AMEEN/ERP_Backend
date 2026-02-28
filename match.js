// match.js  —  Mongoose model for match history
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    matchDate:          { type: String, required: true },
    result:             { type: String, enum: ['win', 'draw', 'loss'], required: true },
    me_normalGoals:     { type: Number, default: 0 },
    me_penaltyGoals:    { type: Number, default: 0 },
    me_freekickGoals:   { type: Number, default: 0 },
    me_cornerGoals:     { type: Number, default: 0 },
    me_ownGoals:        { type: Number, default: 0 },
    friend_normalGoals:   { type: Number, default: 0 },
    friend_penaltyGoals:  { type: Number, default: 0 },
    friend_freekickGoals: { type: Number, default: 0 },
    friend_cornerGoals:   { type: Number, default: 0 },
    friend_ownGoals:      { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);