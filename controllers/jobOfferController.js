const JobOffer = require("../models/JobOffer")
const Application = require("../models/Application")
const Department = require("../models/Department")
const mongoose = require("mongoose")

// Fonctions publiques (sans authentification)
exports.getPublicJobOffers = async (req, res) => {
  try {
    const { search, location, contractType, experience, page = 1, limit = 10 } = req.query
    const skip = (page - 1) * limit

    // Construire le filtre
    const filter = { isActive: true }

    // Vérifier les dates de publication et de clôture
    const now = new Date()
    filter.publicationDate = { $lte: now }
    filter.closingDate = { $gte: now }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { requirements: { $regex: search, $options: "i" } },
      ]
    }

    if (location) filter.location = { $regex: location, $options: "i" }
    if (contractType) filter.contractType = contractType
    if (experience) filter.experience = experience

    console.log("Filter for public job offers:", filter)

    // Exécuter la requête
    const offers = await JobOffer.find(filter)
      .populate("department", "name nom")
      .sort({ publicationDate: -1 })
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean()

    console.log(`Found ${offers.length} public job offers`)

    // Compter le total pour la pagination
    const total = await JobOffer.countDocuments(filter)

    // Ajouter le nombre de candidatures pour chaque offre
    const offersWithStats = await Promise.all(
      offers.map(async (offer) => {
        const applicationsCount = await Application.countDocuments({ jobOffer: offer._id })
        return {
          ...offer,
          applicationsCount,
          viewsCount: offer.viewsCount || 0,
        }
      }),
    )

    res.status(200).json({
      offers: offersWithStats,
      pagination: {
        total,
        page: Number.parseInt(page),
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Erreur lors de la récupération des offres d'emploi:", error)
    res.status(500).json({ message: "Erreur lors de la récupération des offres d'emploi" })
  }
}

exports.getPublicJobOffer = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID d'offre invalide" })
    }

    const now = new Date()
    const offer = await JobOffer.findOne({
      _id: id,
      isActive: true,
      publicationDate: { $lte: now },
      closingDate: { $gte: now },
    })
      .populate("department", "name nom")
      .lean()

    if (!offer) {
      return res.status(404).json({ message: "Offre d'emploi non trouvée" })
    }

    // Incrémenter le compteur de vues
    await JobOffer.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } })

    // Ajouter le nombre de candidatures
    const applicationsCount = await Application.countDocuments({ jobOffer: offer._id })

    res.status(200).json({
      ...offer,
      applicationsCount,
      viewsCount: (offer.viewsCount || 0) + 1, // Inclure l'incrémentation actuelle
    })
  } catch (error) {
    console.error("Erreur lors de la récupération de l'offre d'emploi:", error)
    res.status(500).json({ message: "Erreur lors de la récupération de l'offre d'emploi" })
  }
}

// Fonctions administratives (avec authentification)
exports.getJobOffers = async (req, res) => {
  try {
    const { search, status, department, page = 1, limit = 10, sort = "createdAt", direction = "desc" } = req.query
    const skip = (page - 1) * limit

    // Construire le filtre
    const filter = {}

    if (search) {
      filter.$or = [{ title: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]
    }

    // Filtrage par statut
    const now = new Date()
    if (status === "active") {
      filter.isActive = true
      filter.publicationDate = { $lte: now }
      filter.closingDate = { $gte: now }
    } else if (status === "draft") {
      filter.isActive = false
    } else if (status === "expired") {
      filter.closingDate = { $lt: now }
    } else if (status === "scheduled") {
      filter.publicationDate = { $gt: now }
    }

    if (department) filter.department = department

    // Construire le tri
    const sortObj = {}
    sortObj[sort] = direction === "desc" ? -1 : 1

    // Exécuter la requête avec population du département
    const offers = await JobOffer.find(filter)
      .populate("department", "name nom")
      .populate("createdBy", "firstName lastName nom prenom")
      .sort(sortObj)
      .skip(skip)
      .limit(Number.parseInt(limit))
      .lean()

    // Compter le total pour la pagination
    const total = await JobOffer.countDocuments(filter)

    // Ajouter le nombre de candidatures pour chaque offre
    const offersWithStats = await Promise.all(
      offers.map(async (offer) => {
        const applicationsCount = await Application.countDocuments({ jobOffer: offer._id })
        const newApplicationsCount = await Application.countDocuments({
          jobOffer: offer._id,
          status: "received",
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        })

        // Déterminer le statut de l'offre
        let offerStatus = "draft"
        if (offer.isActive) {
          const publicationDate = new Date(offer.publicationDate || offer.createdAt)
          const closingDate = new Date(offer.closingDate)

          if (publicationDate > now) {
            offerStatus = "scheduled"
          } else if (closingDate < now) {
            offerStatus = "expired"
          } else {
            offerStatus = "active"
          }
        }

        return {
          ...offer,
          applicationsCount,
          newApplicationsCount,
          status: offerStatus,
        }
      }),
    )

    res.status(200).json({
      offers: offersWithStats,
      pagination: {
        total,
        page: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        limit: Number.parseInt(limit),
      },
    })
  } catch (error) {
    console.error("Erreur lors de la récupération des offres d'emploi:", error)
    res.status(500).json({ message: "Erreur lors de la récupération des offres d'emploi" })
  }
}

exports.getJobOffer = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID d'offre invalide" })
    }

    const offer = await JobOffer.findById(id)
      .populate("department", "name nom")
      .populate("createdBy", "firstName lastName email profilePicture nom prenom")
      .lean()

    if (!offer) {
      return res.status(404).json({ message: "Offre d'emploi non trouvée" })
    }

    // Ajouter les statistiques
    const stats = {
      totalApplications: await Application.countDocuments({ jobOffer: offer._id }),
      newApplications: await Application.countDocuments({
        jobOffer: offer._id,
        status: "received",
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      interviewScheduled: await Application.countDocuments({
        jobOffer: offer._id,
        status: "interview",
      }),
      hired: await Application.countDocuments({
        jobOffer: offer._id,
        status: "hired",
      }),
    }

    res.status(200).json({
      ...offer,
      stats,
    })
  } catch (error) {
    console.error("Erreur lors de la récupération de l'offre d'emploi:", error)
    res.status(500).json({ message: "Erreur lors de la récupération de l'offre d'emploi" })
  }
}

exports.createJobOffer = async (req, res) => {
  try {
    const {
      title,
      description,
      requirements,
      responsibilities,
      benefits,
      location,
      contractType,
      experience,
      skills,
      salary,
      department,
      customQuestions,
      publicationDate,
      closingDate,
      isActive,
    } = req.body

    // Validation
    if (!title || !description || !location || !contractType || !department) {
      return res.status(400).json({ message: "Veuillez remplir tous les champs obligatoires" })
    }

    // Vérifier que le département existe
    const departmentExists = await Department.findById(department)
    if (!departmentExists) {
      return res.status(400).json({ message: "Département invalide" })
    }

    // Créer l'offre
    const jobOffer = new JobOffer({
      title,
      description,
      requirements: requirements || [],
      responsibilities: responsibilities || [],
      benefits: benefits || [],
      location,
      contractType,
      experience: experience || "junior",
      skills: skills || [],
      salary: salary || { min: 0, max: 0, currency: "EUR", isVisible: false },
      department,
      customQuestions: customQuestions || [],
      publicationDate: publicationDate || new Date(),
      closingDate: closingDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 jours par défaut
      isActive: isActive !== undefined ? isActive : false,
      createdBy: req.user.id,
      viewsCount: 0,
    })

    await jobOffer.save()

    // Populer les données pour la réponse
    await jobOffer.populate("department", "name nom")
    await jobOffer.populate("createdBy", "firstName lastName nom prenom")

    res.status(201).json({
      message: "Offre d'emploi créée avec succès",
      jobOffer,
    })
  } catch (error) {
    console.error("Erreur lors de la création de l'offre d'emploi:", error)
    res.status(500).json({ message: "Erreur lors de la création de l'offre d'emploi" })
  }
}

exports.updateJobOffer = async (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID d'offre invalide" })
    }

    // Vérifier si l'offre existe
    const jobOffer = await JobOffer.findById(id)
    if (!jobOffer) {
      return res.status(404).json({ message: "Offre d'emploi non trouvée" })
    }

    // Si le département est modifié, vérifier qu'il existe
    if (updateData.department) {
      const departmentExists = await Department.findById(updateData.department)
      if (!departmentExists) {
        return res.status(400).json({ message: "Département invalide" })
      }
    }

    // Mettre à jour
    const updatedJobOffer = await JobOffer.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true },
    )
      .populate("department", "name nom")
      .populate("createdBy", "firstName lastName nom prenom")

    res.status(200).json({
      message: "Offre d'emploi mise à jour avec succès",
      jobOffer: updatedJobOffer,
    })
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'offre d'emploi:", error)
    res.status(500).json({ message: "Erreur lors de la mise à jour de l'offre d'emploi" })
  }
}

exports.deleteJobOffer = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID d'offre invalide" })
    }

    // Vérifier si l'offre existe
    const jobOffer = await JobOffer.findById(id)
    if (!jobOffer) {
      return res.status(404).json({ message: "Offre d'emploi non trouvée" })
    }

    // Vérifier s'il y a des candidatures
    const applicationsCount = await Application.countDocuments({ jobOffer: id })
    if (applicationsCount > 0) {
      // Au lieu de supprimer, désactiver l'offre
      await JobOffer.findByIdAndUpdate(id, {
        isActive: false,
        closingDate: new Date(),
        updatedAt: new Date(),
      })

      return res.status(200).json({
        message: "L'offre d'emploi a été désactivée car elle a des candidatures associées",
      })
    }

    // Supprimer l'offre
    await JobOffer.findByIdAndDelete(id)

    res.status(200).json({ message: "Offre d'emploi supprimée avec succès" })
  } catch (error) {
    console.error("Erreur lors de la suppression de l'offre d'emploi:", error)
    res.status(500).json({ message: "Erreur lors de la suppression de l'offre d'emploi" })
  }
}

exports.getJobOfferStats = async (req, res) => {
  try {
    const now = new Date()

    // Statistiques générales
    const stats = {
      total: await JobOffer.countDocuments(),
      active: await JobOffer.countDocuments({
        isActive: true,
        publicationDate: { $lte: now },
        closingDate: { $gte: now },
      }),
      draft: await JobOffer.countDocuments({ isActive: false }),
      expired: await JobOffer.countDocuments({ closingDate: { $lt: now } }),
      scheduled: await JobOffer.countDocuments({ publicationDate: { $gt: now } }),
    }

    // Statistiques par département
    const departmentStats = await JobOffer.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "departmentInfo",
        },
      },
      { $unwind: "$departmentInfo" },
      {
        $project: {
          _id: 1,
          count: 1,
          name: { $ifNull: ["$departmentInfo.name", "$departmentInfo.nom"] },
        },
      },
      { $sort: { count: -1 } },
    ])

    // Statistiques par type de contrat
    const contractTypeStats = await JobOffer.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$contractType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    // Statistiques des candidatures
    const applicationStats = {
      total: await Application.countDocuments(),
      received: await Application.countDocuments({ status: "received" }),
      reviewing: await Application.countDocuments({ status: "reviewing" }),
      interview: await Application.countDocuments({ status: "interview" }),
      hired: await Application.countDocuments({ status: "hired" }),
      rejected: await Application.countDocuments({ status: "rejected" }),
    }

    // Candidatures récentes (30 derniers jours)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentApplications = await Application.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    })

    // Tendances mensuelles (6 derniers mois)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyTrends = await JobOffer.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ])

    res.status(200).json({
      stats: {
        ...stats,
        recentApplications,
      },
      departmentStats,
      contractTypeStats,
      applicationStats,
      monthlyTrends,
    })
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error)
    res.status(500).json({ message: "Erreur lors de la récupération des statistiques" })
  }
}
