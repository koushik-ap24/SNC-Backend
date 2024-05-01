import mongoose from 'mongoose';

export const tokenSchema = new mongoose.Schema({
  renderAPI: { type: String, required: false },
}, { _id: false });
