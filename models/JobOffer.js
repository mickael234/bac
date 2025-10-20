const mongoose = require("mongoose")

const jobOfferSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Le titre est obligatoire"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "La description est obligatoire"],
    },
    requirements: {
      type: [String],
      default: [],
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    benefits: {
      type: [String],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      required: [true, "La localisation est obligatoire"],
      trim: true,
    },
    contractType: {
      type: String,
      required: [true, "Le type de contrat est obligatoire"],
      enum: ["CDI", "CDD", "Stage", "Alternance", "Freelance"],
    },
    experience: {
      type: String,
      enum: ["junior", "intermediate", "senior", "expert"],
      default: "junior",
    },
    salary: {
      min: {
        type: Number,
        default: 0,
      },
      max: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: "EUR",
      },
      isVisible: {
        type: Boolean,
        default: false,
      },
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: [true, "Le département est obligatoire"],
    },
    customQuestions: {
      type: [
        {
          question: String,
          type: {
            type: String,
            enum: ["text", "textarea", "select", "radio", "checkbox"],
            default: "text",
          },
          options: [String],
          required: {
            type: Boolean,
            default: false,
          },
        },
      ],
      default: [],
    },
    publicationDate: {
      type: Date,
      default: Date.now,
    },
    closingDate: {
      type: Date,
      required: [true, "La date de clôture est obligatoire"],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Alias pour la compatibilité avec les anciens champs
jobOfferSchema.virtual("deadline").get(function () {
  return this.closingDate
})

jobOfferSchema.virtual("applicationDeadline").get(function () {
  return this.closingDate
})

// Inclure les virtuals lors de la conversion en JSON
jobOfferSchema.set("toJSON", { virtuals: true })
jobOfferSchema.set("toObject", { virtuals: true })

const JobOffer = mongoose.model("JobOffer", jobOfferSchema)

module.exports = JobOffer
