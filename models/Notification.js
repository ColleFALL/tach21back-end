import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    category: {
      type: String,
      enum: ["SECURITY", "TRANSACTION", "SYSTEM"],
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    redirectUrl: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
