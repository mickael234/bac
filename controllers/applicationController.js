const Application = require("../models/Application")
const JobOffer = require("../models/JobOffer")
const mongoose = require("mongoose")
const fs = require("fs")
const path = require("path")

// Fonction publique pour postuler
exports.submitApplication = async (req, res) => {
  try {
    const { jobOfferId } = req.params
    const { candidate, customAnswers, source } = req.body

    console.log("=== DÉBUT SOUMISSION CANDIDATURE ===")
    console.log("Job Offer ID:", jobOfferId)
    console.log("Files reçus:", req.files ? Object.keys(req.files) : "Aucun")

    // Parser les données JSON si elles sont en string
    let candidateData, customAnswersData

    try {
      candidateData = typeof candidate === "string" ? JSON.parse(candidate) : candidate
      customAnswersData = typeof customAnswers === "string" ? JSON.parse(customAnswers) : customAnswers || []
    } catch (parseError) {
      console.error("Erreur parsing JSON:", parseError)
      return res.status(400).json({
        message: "Données invalides reçues",
      })
    }

    console.log("Candidat:", candidateData?.firstName, candidateData?.lastName)

    // Validation des champs obligatoires
    if (!jobOfferId || !candidateData?.firstName || !candidateData?.lastName || !candidateData?.email) {
      console.log("Validation échouée - champs manquants")
      return res.status(400).json({
        message: "Veuillez remplir tous les champs obligatoires (prénom, nom, email)",
      })
    }

    // Validation de l'ID de l'offre
    if (!mongoose.Types.ObjectId.isValid(jobOfferId)) {
      console.log("ID offre invalide:", jobOfferId)
      return res.status(400).json({
        message: "ID d'offre d'emploi invalide",
      })
    }

    // Vérifier si l'offre existe et est active
    console.log("Recherche de l'offre d'emploi...")
    const jobOffer = await JobOffer.findOne({
      _id: jobOfferId,
      isActive: true,
    }).populate("department", "nom")

    if (!jobOffer) {
      console.log("Offre non trouvée ou inactive")
      return res.status(404).json({
        message: "Offre d'emploi non trouvée ou expirée",
      })
    }

    console.log("Offre trouvée:", jobOffer.title)

    // Vérifier si le candidat a déjà postulé
    const existingApplication = await Application.findOne({
      jobOffer: jobOfferId,
      email: candidateData.email.toLowerCase(),
    })

    if (existingApplication) {
      console.log("Candidature déjà existante pour:", candidateData.email)
      return res.status(400).json({
        message: "Vous avez déjà postulé à cette offre",
      })
    }

    // Créer la candidature
    console.log("Création de la candidature...")
    const application = new Application({
      jobOffer: jobOfferId,
      firstName: candidateData.firstName,
      lastName: candidateData.lastName,
      email: candidateData.email.toLowerCase(),
      phone: candidateData.phone || "",
      address: candidateData.address || {},
      linkedin: candidateData.linkedin || "",
      portfolio: candidateData.portfolio || "",
      experience: candidateData.experience || "",
      education: candidateData.education || "",
      coverLetter: candidateData.coverLetter || "",
      customAnswers: customAnswersData,
      source: source || "website",
      status: "received",
    })

    // Traiter les fichiers si présents
    if (req.files) {
      console.log("Traitement des fichiers...")

      if (req.files.cv && req.files.cv[0]) {
        console.log("CV reçu:", req.files.cv[0].originalname)
        application.resume = {
          filename: req.files.cv[0].filename,
          path: req.files.cv[0].path,
          originalname: req.files.cv[0].originalname,
          mimetype: req.files.cv[0].mimetype,
          size: req.files.cv[0].size,
        }
      }

      if (req.files.coverLetter && req.files.coverLetter[0]) {
        console.log("Lettre de motivation reçue:", req.files.coverLetter[0].originalname)
        application.coverLetterFile = {
          filename: req.files.coverLetter[0].filename,
          path: req.files.coverLetter[0].path,
          originalname: req.files.coverLetter[0].originalname,
          mimetype: req.files.coverLetter[0].mimetype,
          size: req.files.coverLetter[0].size,
        }
      }

      if (req.files.portfolio && req.files.portfolio[0]) {
        console.log("Portfolio reçu:", req.files.portfolio[0].originalname)
        application.portfolioFile = {
          filename: req.files.portfolio[0].filename,
          path: req.files.portfolio[0].path,
          originalname: req.files.portfolio[0].originalname,
          mimetype: req.files.portfolio[0].mimetype,
          size: req.files.portfolio[0].size,
        }
      }
    }

    // Sauvegarder la candidature
    console.log("Sauvegarde en base de données...")
    await application.save()
    console.log("Candidature sauvegardée avec ID:", application._id)

    // Envoyer l'email de confirmation (ne pas bloquer si ça échoue)
    console.log("Envoi de l'email de confirmation...")
    try {
      await sendApplicationConfirmationEmail(candidateData, jobOffer, application._id)
      console.log("Email de confirmation envoyé")
    } catch (emailError) {
      console.error("Erreur envoi email (non bloquant):", emailError.message)
    }

    console.log("=== CANDIDATURE SOUMISE AVEC SUCCÈS ===")

    res.status(201).json({
      success: true,
      message: "Votre candidature a été soumise avec succès. Un email de confirmation vous a été envoyé.",
      applicationId: application._id,
      data: {
        applicationNumber: application._id,
        jobTitle: jobOffer.title,
        submittedAt: application.createdAt,
      },
    })
  } catch (error) {
    console.error("=== ERREUR SOUMISSION CANDIDATURE ===")
    console.error("Erreur:", error)
    console.error("Stack:", error.stack)

    // Nettoyer les fichiers uploadés en cas d'erreur
    if (req.files) {
      Object.values(req.files)
        .flat()
        .forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
            console.log("Fichier nettoyé:", file.path)
          }
        })
    }

    res.status(500).json({
      success: false,
      message: "Erreur lors de la soumission de la candidature. Veuillez réessayer.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

// Fonction pour envoyer l'email de confirmation
const sendApplicationConfirmationEmail = async (candidate, jobOffer, applicationId) => {
  try {
    // Vérifier si les variables d'environnement sont définies
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn("Variables d'environnement EMAIL non configurées, email non envoyé")
      return false
    }

    const nodemailer = require("nodemailer")

    // Créer le transporteur
    const transporter = nodemailer.createTransporter({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    })

    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .highlight { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .button { display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Candidature reçue avec succès !</h1>
          </div>
          <div class="content">
            <p>Bonjour <strong>${candidate.firstName} ${candidate.lastName}</strong>,</p>
            
            <p>Nous avons bien reçu votre candidature pour le poste :</p>
            
            <div class="highlight">
              <h3>${jobOffer.title}</h3>
              <p><strong>Département :</strong> ${jobOffer.department?.nom || "Non spécifié"}</p>
              <p><strong>Lieu :</strong> ${jobOffer.location || "Non spécifié"}</p>
              <p><strong>Type de contrat :</strong> ${jobOffer.contractType || "Non spécifié"}</p>
            </div>
            
            <p><strong>Détails de votre candidature :</strong></p>
            <ul>
              <li><strong>Numéro de candidature :</strong> ${applicationId}</li>
              <li><strong>Date de soumission :</strong> ${new Date().toLocaleDateString("fr-FR")}</li>
              <li><strong>Email :</strong> ${candidate.email}</li>
              ${candidate.phone ? `<li><strong>Téléphone :</strong> ${candidate.phone}</li>` : ""}
            </ul>
            
            <p>Votre candidature est maintenant en cours d'examen par notre équipe de recrutement. Nous vous contacterons dans les plus brefs délais si votre profil correspond à nos attentes.</p>
            
            <p><strong>Prochaines étapes :</strong></p>
            <ol>
              <li>Examen de votre candidature par notre équipe RH</li>
              <li>Présélection des candidats</li>
              <li>Entretiens avec les candidats retenus</li>
              <li>Décision finale</li>
            </ol>
            
            <p>Si vous avez des questions concernant votre candidature, n'hésitez pas à nous contacter en mentionnant votre numéro de candidature.</p>
            
            <p>Merci pour l'intérêt que vous portez à notre entreprise !</p>
            
            <div class="footer">
              <p>Cordialement,<br>
              <strong>L'équipe de recrutement</strong><br>
              Système de gestion RH</p>
              <p><em>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</em></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    const info = await transporter.sendMail({
      from: `"Équipe RH" <${process.env.EMAIL_USER}>`,
      to: candidate.email,
      subject: `Confirmation de candidature - ${jobOffer.title}`,
      html: emailContent,
    })

    console.log(`Email de confirmation envoyé à ${candidate.email}: ${info.messageId}`)
    return true
  } catch (error) {
    console.error(`Erreur lors de l'envoi de l'email de confirmation:`, error)
    throw error
  }
}

// Fonctions administratives (avec authentification)
exports.getApplications = async (req, res) => {
  try {
    const { jobOffer, status, search, rating, startDate, endDate, page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    // Construire le filtre
    const filter = {}

    if (jobOffer) filter.jobOffer = jobOffer
    if (status) filter.status = status
    if (rating) filter.rating = { $gte: Number.parseInt(rating) }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ]
    }

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    }

    // Exécuter la requête
    const applications = await Application.find(filter)
      .populate({
        path: "jobOffer",
        select: "title department location contractType",
        populate: {
          path: "department",
          select: "nom name",
        },
      })
      .populate("notes.createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean()

    // Compter le total pour la pagination
    const total = await Application.countDocuments(filter)

    res.status(200).json({
      applications,
      pagination: {
        total,
        page: Number.parseInt(page),
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Erreur lors de la récupération des candidatures:", error)
    res.status(500).json({ message: "Erreur lors de la récupération des candidatures" })
  }
}

exports.getApplication = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de candidature invalide" })
    }

    const application = await Application.findById(id)
      .populate("jobOffer")
      .populate("notes.createdBy", "firstName lastName profilePicture")
      .populate("interviews.interviewers", "firstName lastName email profilePicture")
      .lean()

    if (!application) {
      return res.status(404).json({ message: "Candidature non trouvée" })
    }

    res.status(200).json(application)
  } catch (error) {
    console.error("Erreur lors de la récupération de la candidature:", error)
    res.status(500).json({ message: "Erreur lors de la récupération de la candidature" })
  }
}

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    console.log(`Mise à jour du statut de la candidature ${id} vers ${status}`)

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de candidature invalide" })
    }

    if (!["received", "reviewing", "interview", "hired", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Statut invalide" })
    }

    const application = await Application.findById(id)
    if (!application) {
      return res.status(404).json({ message: "Candidature non trouvée" })
    }

    const oldStatus = application.status
    application.status = status
    await application.save()

    // Ajouter une note automatique pour le changement de statut
    application.notes.push({
      content: `Statut changé de "${oldStatus}" vers "${status}"`,
      createdBy: req.user.id,
      createdAt: new Date(),
    })
    await application.save()

    console.log(`Statut mis à jour avec succès: ${oldStatus} -> ${status}`)

    res.status(200).json({
      success: true,
      message: "Statut de la candidature mis à jour",
      application: {
        _id: application._id,
        status: application.status,
      },
    })
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error)
    res.status(500).json({ message: "Erreur lors de la mise à jour du statut" })
  }
}

exports.addApplicationNote = async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de candidature invalide" })
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({ message: "Le contenu de la note est requis" })
    }

    const application = await Application.findById(id)
    if (!application) {
      return res.status(404).json({ message: "Candidature non trouvée" })
    }

    const note = {
      content,
      createdBy: req.user.id,
      createdAt: new Date(),
    }

    application.notes.push(note)
    await application.save()

    // Récupérer la note avec les informations de l'utilisateur
    const populatedApplication = await Application.findById(id)
      .populate("notes.createdBy", "firstName lastName profilePicture")
      .lean()

    const addedNote = populatedApplication.notes[populatedApplication.notes.length - 1]

    res.status(201).json({
      message: "Note ajoutée avec succès",
      note: addedNote,
    })
  } catch (error) {
    console.error("Erreur lors de l'ajout de la note:", error)
    res.status(500).json({ message: "Erreur lors de l'ajout de la note" })
  }
}

exports.updateApplicationRating = async (req, res) => {
  try {
    const { id } = req.params
    const { rating } = req.body

    console.log(`Mise à jour de la note de la candidature ${id} vers ${rating}`)

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de candidature invalide" })
    }

    if (rating < 0 || rating > 5) {
      return res.status(400).json({ message: "La note doit être entre 0 et 5" })
    }

    const application = await Application.findById(id)
    if (!application) {
      return res.status(404).json({ message: "Candidature non trouvée" })
    }

    const oldRating = application.rating || 0
    application.rating = rating
    await application.save()

    // Ajouter une note automatique pour le changement de note
    application.notes.push({
      content: `Note mise à jour: ${oldRating}/5 → ${rating}/5`,
      createdBy: req.user.id,
      createdAt: new Date(),
    })
    await application.save()

    console.log(`Note mise à jour avec succès: ${oldRating} -> ${rating}`)

    res.status(200).json({
      success: true,
      message: "Note de la candidature mise à jour",
      application: {
        _id: application._id,
        rating: application.rating,
      },
    })
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la note:", error)
    res.status(500).json({ message: "Erreur lors de la mise à jour de la note" })
  }
}

exports.scheduleInterview = async (req, res) => {
  try {
    const { id } = req.params
    const { date, duration, type, location, interviewers } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de candidature invalide" })
    }

    if (!date) {
      return res.status(400).json({ message: "La date de l'entretien est requise" })
    }

    const application = await Application.findById(id)
    if (!application) {
      return res.status(404).json({ message: "Candidature non trouvée" })
    }

    const interview = {
      date: new Date(date),
      duration: duration || 60,
      type: type || "inperson",
      location: location || "",
      interviewers: interviewers || [],
      status: "scheduled",
    }

    application.interviews.push(interview)

    // Mettre à jour le statut si nécessaire
    if (application.status === "received" || application.status === "reviewing") {
      application.status = "interview"
    }

    await application.save()

    // Ajouter une note automatique pour l'entretien
    application.notes.push({
      content: `Entretien programmé pour le ${new Date(date).toLocaleDateString()}`,
      createdBy: req.user.id,
      createdAt: new Date(),
    })
    await application.save()

    // Récupérer l'entretien avec les informations des interviewers
    const populatedApplication = await Application.findById(id)
      .populate("interviews.interviewers", "firstName lastName email")
      .lean()

    const addedInterview = populatedApplication.interviews[populatedApplication.interviews.length - 1]

    res.status(201).json({
      message: "Entretien programmé avec succès",
      interview: addedInterview,
    })
  } catch (error) {
    console.error("Erreur lors de la programmation de l'entretien:", error)
    res.status(500).json({ message: "Erreur lors de la programmation de l'entretien" })
  }
}

exports.updateInterview = async (req, res) => {
  try {
    const { id, interviewId } = req.params
    const { date, duration, type, location, interviewers, status, notes } = req.body

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "ID invalide" })
    }

    const application = await Application.findById(id)
    if (!application) {
      return res.status(404).json({ message: "Candidature non trouvée" })
    }

    const interview = application.interviews.id(interviewId)
    if (!interview) {
      return res.status(404).json({ message: "Entretien non trouvé" })
    }

    // Mettre à jour les champs
    if (date) interview.date = new Date(date)
    if (duration) interview.duration = duration
    if (type) interview.type = type
    if (location !== undefined) interview.location = location
    if (interviewers) interview.interviewers = interviewers
    if (status) interview.status = status
    if (notes !== undefined) interview.notes = notes

    await application.save()

    // Ajouter une note automatique pour la mise à jour
    application.notes.push({
      content: `Entretien mis à jour (${status || "modifié"})`,
      createdBy: req.user.id,
      createdAt: new Date(),
    })
    await application.save()

    // Récupérer l'entretien avec les informations des interviewers
    const populatedApplication = await Application.findById(id)
      .populate("interviews.interviewers", "firstName lastName email")
      .lean()

    const updatedInterview = populatedApplication.interviews.find((i) => i._id.toString() === interviewId)

    res.status(200).json({
      message: "Entretien mis à jour avec succès",
      interview: updatedInterview,
    })
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'entretien:", error)
    res.status(500).json({ message: "Erreur lors de la mise à jour de l'entretien" })
  }
}

exports.downloadFile = async (req, res) => {
  try {
    const { id, fileType } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de candidature invalide" })
    }

    const application = await Application.findById(id)
    if (!application) {
      return res.status(404).json({ message: "Candidature non trouvée" })
    }

    let fileInfo
    switch (fileType) {
      case "resume":
        fileInfo = application.resume
        break
      case "coverLetter":
        fileInfo = application.coverLetterFile
        break
      case "portfolio":
        fileInfo = application.portfolioFile
        break
      default:
        return res.status(400).json({ message: "Type de fichier invalide" })
    }

    if (!fileInfo || !fileInfo.path) {
      return res.status(404).json({ message: "Fichier non trouvé" })
    }

    const filePath = path.resolve(fileInfo.path)
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Fichier physique non trouvé" })
    }

    res.setHeader("Content-Disposition", `attachment; filename="${fileInfo.originalname}"`)
    res.setHeader("Content-Type", fileInfo.mimetype)

    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error) {
    console.error("Erreur lors du téléchargement:", error)
    res.status(500).json({ message: "Erreur lors du téléchargement du fichier" })
  }
}

exports.getApplicationStats = async (req, res) => {
  try {
    // Statistiques générales
    const stats = [
      { _id: "received", count: await Application.countDocuments({ status: "received" }) },
      { _id: "reviewing", count: await Application.countDocuments({ status: "reviewing" }) },
      { _id: "interview", count: await Application.countDocuments({ status: "interview" }) },
      { _id: "hired", count: await Application.countDocuments({ status: "hired" }) },
      { _id: "rejected", count: await Application.countDocuments({ status: "rejected" }) },
    ]

    // Statistiques par offre d'emploi
    const jobOfferStats = await Application.aggregate([
      { $group: { _id: "$jobOffer", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "joboffers",
          localField: "_id",
          foreignField: "_id",
          as: "jobOfferInfo",
        },
      },
      { $unwind: "$jobOfferInfo" },
      {
        $project: {
          _id: 1,
          count: 1,
          title: "$jobOfferInfo.title",
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ])

    // Statistiques par jour (30 derniers jours)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyStats = await Application.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    // Taux de conversion
    const totalApplications = await Application.countDocuments()
    const hiredApplications = await Application.countDocuments({ status: "hired" })
    const interviewApplications = await Application.countDocuments({ status: "interview" })
    const reviewingApplications = await Application.countDocuments({ status: "reviewing" })

    const conversionStats = {
      receivedToReviewing: totalApplications > 0 ? (reviewingApplications / totalApplications) * 100 : 0,
      reviewingToInterview: reviewingApplications > 0 ? (interviewApplications / reviewingApplications) * 100 : 0,
      interviewToHired: interviewApplications > 0 ? (hiredApplications / interviewApplications) * 100 : 0,
      overallConversion: totalApplications > 0 ? (hiredApplications / totalApplications) * 100 : 0,
    }

    res.status(200).json({
      stats,
      jobOfferStats,
      dailyStats,
      conversionStats,
    })
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error)
    res.status(500).json({ message: "Erreur lors de la récupération des statistiques" })
  }
}

exports.getApplicationAnalytics = async (req, res) => {
  try {
    const { timeRange = "month" } = req.query

    const startDate = new Date()
    switch (timeRange) {
      case "week":
        startDate.setDate(startDate.getDate() - 7)
        break
      case "month":
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      default:
        startDate.setMonth(startDate.getMonth() - 1)
    }

    // Statistiques générales pour la période
    const totalApplications = await Application.countDocuments({
      createdAt: { $gte: startDate },
    })

    // Moyenne par jour
    const daysDiff = Math.ceil((new Date() - startDate) / (1000 * 60 * 60 * 24))
    const averagePerDay = totalApplications / daysDiff

    // Offre la plus populaire
    const topJobOffer = await Application.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: "$jobOffer", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: "joboffers",
          localField: "_id",
          foreignField: "_id",
          as: "jobOfferInfo",
        },
      },
      { $unwind: "$jobOfferInfo" },
      {
        $project: {
          title: "$jobOfferInfo.title",
          count: 1,
        },
      },
    ])

    // Évolution par jour
    const dailyEvolution = await Application.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ])

    res.status(200).json({
      totalApplications,
      averagePerDay: Math.round(averagePerDay * 100) / 100,
      topJobTitle: topJobOffer.length > 0 ? topJobOffer[0].title : "Aucune",
      dailyEvolution,
      timeRange,
      startDate,
      endDate: new Date(),
    })
  } catch (error) {
    console.error("Erreur lors de la récupération des analytics:", error)
    res.status(500).json({ message: "Erreur lors de la récupération des analytics" })
  }
}
