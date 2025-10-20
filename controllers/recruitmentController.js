const JobOffer = require("../models/JobOffer")
const Application = require("../models/Application")
const Department = require("../models/Department")
const mongoose = require("mongoose")

exports.getRecruitmentStats = async (req, res) => {
  try {
    const { timeRange = "month" } = req.query

    // Calculer la date de début selon la période
    const startDate = new Date()
    switch (timeRange) {
      case "week":
        startDate.setDate(startDate.getDate() - 7)
        break
      case "month":
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case "quarter":
        startDate.setMonth(startDate.getMonth() - 3)
        break
      case "year":
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      default:
        startDate.setMonth(startDate.getMonth() - 1)
    }

    // 1. Candidatures au fil du temps
    const applicationsOverTime = await Application.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: timeRange === "week" ? "%Y-%m-%d" : timeRange === "year" ? "%Y-%m" : "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          applications: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          name: "$_id",
          applications: 1,
          _id: 0,
        },
      },
    ])

    // 2. Candidatures par statut
    const applicationsByStatus = await Application.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$status",
          value: { $sum: 1 },
        },
      },
      {
        $project: {
          name: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", "received"] }, then: "Reçue" },
                { case: { $eq: ["$_id", "reviewing"] }, then: "En cours d'examen" },
                { case: { $eq: ["$_id", "interview"] }, then: "Entretien" },
                { case: { $eq: ["$_id", "hired"] }, then: "Embauché" },
                { case: { $eq: ["$_id", "rejected"] }, then: "Rejetée" },
              ],
              default: "$_id",
            },
          },
          value: 1,
          _id: 0,
        },
      },
    ])

    // 3. Candidatures par offre d'emploi
    const applicationsByJobOffer = await Application.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $lookup: {
          from: "joboffers",
          localField: "jobOffer",
          foreignField: "_id",
          as: "jobOfferInfo",
        },
      },
      {
        $unwind: "$jobOfferInfo",
      },
      {
        $group: {
          _id: "$jobOffer",
          name: { $first: "$jobOfferInfo.title" },
          value: { $sum: 1 },
        },
      },
      {
        $sort: { value: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          name: 1,
          value: 1,
          _id: 0,
        },
      },
    ])

    // 4. Statistiques générales
    const totalApplications = await Application.countDocuments({
      createdAt: { $gte: startDate },
    })

    const hiredApplications = await Application.countDocuments({
      status: "hired",
      createdAt: { $gte: startDate },
    })

    const conversionRate = totalApplications > 0 ? ((hiredApplications / totalApplications) * 100).toFixed(1) : 0

    // 5. Temps moyen d'embauche (en jours)
    const hiredWithDates = await Application.find({
      status: "hired",
      createdAt: { $gte: startDate },
      updatedAt: { $exists: true },
    }).select("createdAt updatedAt")

    let averageTimeToHire = 0
    if (hiredWithDates.length > 0) {
      const totalDays = hiredWithDates.reduce((sum, app) => {
        const days = Math.ceil((app.updatedAt - app.createdAt) / (1000 * 60 * 60 * 24))
        return sum + days
      }, 0)
      averageTimeToHire = Math.round(totalDays / hiredWithDates.length)
    }

    // 6. Sources de candidatures (simulation car pas encore implémenté)
    const topSources = [
      { name: "LinkedIn", value: Math.floor(totalApplications * 0.4) },
      { name: "Indeed", value: Math.floor(totalApplications * 0.25) },
      { name: "Site Web", value: Math.floor(totalApplications * 0.2) },
      { name: "Recommandation", value: Math.floor(totalApplications * 0.15) },
    ]

    // 7. Taux d'embauche
    const hireRate = totalApplications > 0 ? ((hiredApplications / totalApplications) * 100).toFixed(1) : 0

    const stats = {
      applicationsOverTime,
      applicationsByStatus,
      applicationsByJobOffer,
      topSources,
      totalApplications,
      conversionRate: Number.parseFloat(conversionRate),
      averageTimeToHire,
      hireRate: Number.parseFloat(hireRate),
    }

    console.log("Statistiques de recrutement générées:", stats)

    res.status(200).json(stats)
  } catch (error) {
    console.error("Erreur lors de la génération des statistiques de recrutement:", error)
    res.status(500).json({
      message: "Erreur lors de la génération des statistiques de recrutement",
      error: error.message,
    })
  }
}
