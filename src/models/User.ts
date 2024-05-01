import mongoose from "mongoose";
import { tokenSchema } from "./tokenSchema";

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: false },
  lastName: { type: String, required: false },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  tokens: { type: tokenSchema, required: false },
  uploadedFiles: [
    {
      fileName: { type: String, required: true },
      fileKey: { type: String, required: true },
      date: {type: String, required: true}
    }
  ]
});

export default mongoose.model('Users', userSchema);
