const mongoose = require("mongoose")

const applicationSchema = new mongoose.Schema(
  {
    jobOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobOffer",
      required: [true, "L'offre d'emploi est requise"],
    },
    firstName: {
      type: String,
      required: [true, "Le prénom est requis"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Le nom est requis"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "L'email est requis"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Format d'email invalide"],
    },
    phone: {
      type: String,
      trim: true,
    },
    coverLetter: {
      type: String,
    },
    resume: {
      filename: String,
      path: String,
      originalname: String,
      mimetype: String,
    },
    portfolio: {
      type: String,
      trim: true,
    },
    linkedin: {
      type: String,
      trim: true,
    },
    github: {
      type: String,
      trim: true,
    },
    customAnswers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        question: {
          type: String,
          required: true,
        },
        answer: {
          type: mongoose.Schema.Types.Mixed,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["received", "reviewing", "interview", "hired", "rejected"],
      default: "received",
    },
    notes: [
      {
        content: {
          type: String,
          required: true,
        },
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    interviews: [
      {
        date: {
          type: Date,
          required: true,
        },
        duration: {
          type: Number, // en minutes
          default: 60,
        },
        type: {
          type: String,
          enum: ["phone", "video", "inperson"],
          default: "inperson",
        },
        location: {
          type: String,
        },
        interviewers: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        ],
        notes: {
          type: String,
        },
        status: {
          type: String,
          enum: ["scheduled", "completed", "cancelled", "rescheduled"],
          default: "scheduled",
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Index pour la recherche
applicationSchema.index({ firstName: "text", lastName: "text", email: "text" })

const Application = mongoose.model("Application", applicationSchema)

module.exports = Application
