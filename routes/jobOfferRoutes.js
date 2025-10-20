const express = require("express")
const router = express.Router()
const jobOfferController = require("../controllers/jobOfferController")
const { auth } = require("../middleware/auth")

// Routes publiques (sans authentification)
router.get("/public", jobOfferController.getPublicJobOffers)
router.get("/public/:id", jobOfferController.getPublicJobOffer)

// Routes administratives (avec authentification)
router.use(auth)

router.get("/", jobOfferController.getJobOffers)
router.post("/", jobOfferController.createJobOffer)
router.get("/stats", jobOfferController.getJobOfferStats)
router.get("/:id", jobOfferController.getJobOffer)
router.put("/:id", jobOfferController.updateJobOffer)
router.delete("/:id", jobOfferController.deleteJobOffer)

module.exports = router
