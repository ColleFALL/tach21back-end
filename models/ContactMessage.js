// models/ContactMessage.js
import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom est obligatoire"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "L'email est obligatoire"],
      trim: true,
      lowercase: true,
    },
    message: {
      type: String,
      required: [true, "Le message est obligatoire"],
      trim: true,
    },
  },
  {
    timestamps: true, // ✅ ajoute createdAt & updatedAt automatiquement
  }
);

const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);
export default ContactMessage;
