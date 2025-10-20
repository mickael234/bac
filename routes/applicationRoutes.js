const express = require("express")
const router = express.Router()
const applicationController = require("../controllers/applicationController")
const { auth } = require("../middleware/auth")
const multer = require("multer")
const path = require("path")
const fs = require("fs")

// Créer les dossiers d'upload s'ils n'existent pas
const createUploadDirs = () => {
  const dirs = ["uploads", "uploads/resumes", "uploads/cover-letters", "uploads/portfolios"]

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`Dossier créé: ${dir}`)
    }
  })
}

// Créer les dossiers au chargement du module
createUploadDirs()

// Configuration de Multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "uploads/resumes"

    // Déterminer le dossier selon le type de fichier
    if (file.fieldname === "coverLetter") {
      uploadPath = "uploads/cover-letters"
    } else if (file.fieldname === "portfolio") {
      uploadPath = "uploads/portfolios"
    }

    // S'assurer que le dossier existe
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }

    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    const prefix = file.fieldname === "cv" ? "resume" : file.fieldname === "coverLetter" ? "cover-letter" : "portfolio"
    cb(null, `${prefix}-${uniqueSuffix}${ext}`)
  },
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Format de fichier non supporté pour ${file.fieldname}. Utilisez PDF ou DOC/DOCX.`), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 3, // Maximum 3 fichiers
  },
})

// Middleware de gestion d'erreur pour Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Le fichier est trop volumineux. Taille maximum: 10MB",
      })
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: "Trop de fichiers. Maximum 3 fichiers autorisés",
      })
    }
  }

  if (err.message.includes("Format de fichier non supporté")) {
    return res.status(400).json({ message: err.message })
  }

  console.error("Erreur Multer:", err)
  return res.status(500).json({
    message: "Erreur lors de l'upload des fichiers",
  })
}

// Route publique pour postuler (sans authentification)
router.post(
  "/submit/:jobOfferId",
  upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "coverLetter", maxCount: 1 },
    { name: "portfolio", maxCount: 1 },
  ]),
  handleMulterError,
  applicationController.submitApplication,
)

// Routes administratives (avec authentification)
router.use(auth)

// Routes pour la gestion des candidatures
router.get("/", applicationController.getApplications)
router.get("/stats", applicationController.getApplicationStats)
router.get("/analytics", applicationController.getApplicationAnalytics)
router.get("/:id", applicationController.getApplication)

// Routes pour les actions sur les candidatures
router.patch("/:id/status", applicationController.updateApplicationStatus)
router.patch("/:id/rating", applicationController.updateApplicationRating)
router.patch("/:id/notes", applicationController.addApplicationNote)

// Routes pour les entretiens
router.post("/:id/interviews", applicationController.scheduleInterview)
router.put("/:id/interviews/:interviewId", applicationController.updateInterview)

// Route pour télécharger les fichiers
router.get("/:id/download/:fileType", applicationController.downloadFile)

module.exports = router
