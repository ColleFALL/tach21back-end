import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  resetPasswordToken: { type: String },
resetPasswordExpires: { type: Date },

});

export default mongoose.model("User", userSchema);
