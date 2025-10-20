const express = require("express")
const router = express.Router()
const recruitmentController = require("../controllers/recruitmentController")
const { auth } = require("../middleware/auth")

// Toutes les routes nécessitent une authentification
router.use(auth)

// Route pour les statistiques de recrutement
router.get("/stats", recruitmentController.getRecruitmentStats)

module.exports = router
