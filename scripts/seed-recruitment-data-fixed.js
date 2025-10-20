const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

// Connexion à MongoDB
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/hr-management"

// Modèles (utilisant la même structure que l'application)
const departmentSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true, unique: true },
    description: String,
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    membres: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dateCreation: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ["admin", "manager", "employee"], default: "employee" },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    position: String,
    phone: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

const jobOfferSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    requirements: [String],
    responsibilities: [String],
    benefits: [String],
    location: String,
    contractType: { type: String, enum: ["CDI", "CDD", "Stage", "Alternance", "Freelance"] },
    salary: {
      min: Number,
      max: Number,
      currency: { type: String, default: "EUR" },
      isVisible: Boolean,
    },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    publicationDate: Date,
    closingDate: Date,
    isActive: Boolean,
    viewsCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
)

const applicationSchema = new mongoose.Schema(
  {
    jobOffer: { type: mongoose.Schema.Types.ObjectId, ref: "JobOffer" },
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    coverLetter: String,
    resume: {
      filename: String,
      path: String,
      originalname: String,
      mimetype: String,
    },
    portfolio: String,
    linkedin: String,
    github: String,
    status: {
      type: String,
      enum: ["received", "reviewing", "interview", "hired", "rejected"],
      default: "received",
    },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    notes: [
      {
        content: String,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    interviews: [
      {
        date: Date,
        duration: Number,
        type: { type: String, enum: ["phone", "video", "inperson"], default: "inperson" },
        location: String,
        interviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        notes: String,
        status: {
          type: String,
          enum: ["scheduled", "completed", "cancelled", "rescheduled"],
          default: "scheduled",
        },
      },
    ],
  },
  { timestamps: true },
)

// Modèles
const Department = mongoose.model("Department", departmentSchema)
const User = mongoose.model("User", userSchema)
const JobOffer = mongoose.model("JobOffer", jobOfferSchema)
const Application = mongoose.model("Application", applicationSchema)

async function seedRecruitmentData() {
  try {
    console.log("🚀 Début du seeding des données de recrutement...")

    // Connexion à MongoDB
    await mongoose.connect(MONGODB_URI)
    console.log("✅ Connexion à MongoDB réussie")

    // Nettoyage des données de test existantes
    console.log("🧹 Nettoyage des données de test existantes...")
    await Application.deleteMany({})
    await JobOffer.deleteMany({})
    await User.deleteMany({ email: { $regex: "@company.com$" } })

    // Supprimer seulement les départements de test
    const testDepartments = ["Ressources Humaines", "Informatique", "Commercial", "Marketing", "Finance"]
    await Department.deleteMany({ nom: { $in: testDepartments } })
    console.log("✅ Données de test nettoyées")

    // 1. Créer des départements
    console.log("📁 Création des départements...")
    const departments = await Department.insertMany([
      {
        nom: "Ressources Humaines",
        description: "Gestion du personnel et recrutement",
        dateCreation: new Date(),
      },
      {
        nom: "Informatique",
        description: "Développement et infrastructure IT",
        dateCreation: new Date(),
      },
      {
        nom: "Commercial",
        description: "Ventes et développement commercial",
        dateCreation: new Date(),
      },
      {
        nom: "Marketing",
        description: "Communication et marketing digital",
        dateCreation: new Date(),
      },
      {
        nom: "Finance",
        description: "Comptabilité et gestion financière",
        dateCreation: new Date(),
      },
    ])
    console.log(`✅ ${departments.length} départements créés`)

    // 2. Créer des utilisateurs (RH et managers)
    console.log("👥 Création des utilisateurs...")
    const hashedPassword = await bcrypt.hash("password123", 10)

    const users = await User.insertMany([
      {
        firstName: "Marie",
        lastName: "Dubois",
        email: "marie.dubois@company.com",
        password: hashedPassword,
        role: "admin",
        department: departments[0]._id, // RH
        position: "Directrice RH",
        phone: "+33 1 23 45 67 89",
        isActive: true,
      },
      {
        firstName: "Pierre",
        lastName: "Martin",
        email: "pierre.martin@company.com",
        password: hashedPassword,
        role: "manager",
        department: departments[1]._id, // IT
        position: "Chef de projet IT",
        phone: "+33 1 23 45 67 90",
        isActive: true,
      },
      {
        firstName: "Sophie",
        lastName: "Bernard",
        email: "sophie.bernard@company.com",
        password: hashedPassword,
        role: "manager",
        department: departments[2]._id, // Commercial
        position: "Directrice commerciale",
        phone: "+33 1 23 45 67 91",
        isActive: true,
      },
      {
        firstName: "Thomas",
        lastName: "Petit",
        email: "thomas.petit@company.com",
        password: hashedPassword,
        role: "manager",
        department: departments[3]._id, // Marketing
        position: "Responsable marketing",
        phone: "+33 1 23 45 67 92",
        isActive: true,
      },
      {
        firstName: "Julie",
        lastName: "Moreau",
        email: "julie.moreau@company.com",
        password: hashedPassword,
        role: "employee",
        department: departments[0]._id, // RH
        position: "Chargée de recrutement",
        phone: "+33 1 23 45 67 93",
        isActive: true,
      },
    ])
    console.log(`✅ ${users.length} utilisateurs créés`)

    // 3. Créer des offres d'emploi
    console.log("💼 Création des offres d'emploi...")
    const now = new Date()
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 jours
    const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // -10 jours

    const jobOffers = await JobOffer.insertMany([
      {
        title: "Développeur Full Stack Senior",
        description:
          "Nous recherchons un développeur full stack expérimenté pour rejoindre notre équipe technique dynamique. Vous travaillerez sur des projets innovants utilisant les dernières technologies.",
        requirements: [
          "Minimum 5 ans d'expérience en développement web",
          "Maîtrise de React, Node.js, MongoDB",
          "Connaissance des méthodologies Agile",
          "Anglais technique requis",
        ],
        responsibilities: [
          "Développer et maintenir des applications web",
          "Participer à la conception technique",
          "Encadrer les développeurs juniors",
          "Assurer la qualité du code",
        ],
        benefits: ["Télétravail partiel (3j/semaine)", "Formation continue", "Mutuelle premium", "Tickets restaurant"],
        location: "Lyon",
        contractType: "CDI",
        salary: {
          min: 45000,
          max: 60000,
          currency: "EUR",
          isVisible: true,
        },
        department: departments[1]._id, // IT
        publicationDate: now,
        closingDate: futureDate,
        isActive: true,
        viewsCount: 156,
        createdBy: users[1]._id, // Pierre Martin
      },
      {
        title: "Chef de Projet Marketing Digital",
        description:
          "Rejoignez notre équipe marketing pour piloter nos campagnes digitales et développer notre présence en ligne.",
        requirements: [
          "3-5 ans d'expérience en marketing digital",
          "Maîtrise des outils Google Ads, Facebook Ads",
          "Connaissance du SEO/SEA",
          "Esprit analytique",
        ],
        responsibilities: [
          "Gérer les campagnes publicitaires digitales",
          "Analyser les performances marketing",
          "Coordonner avec les équipes créatives",
          "Optimiser le ROI des campagnes",
        ],
        benefits: ["Primes sur objectifs", "Formation certifiante", "Environnement créatif", "Événements d'équipe"],
        location: "Bordeaux",
        contractType: "CDI",
        salary: {
          min: 35000,
          max: 45000,
          currency: "EUR",
          isVisible: true,
        },
        department: departments[3]._id, // Marketing
        publicationDate: now,
        closingDate: futureDate,
        isActive: true,
        viewsCount: 89,
        createdBy: users[3]._id, // Thomas Petit
      },
      {
        title: "Stagiaire Développeur Web",
        description: "Stage de 6 mois pour découvrir le développement web dans une équipe bienveillante.",
        requirements: [
          "Étudiant en informatique (Bac+3/4)",
          "Bases en HTML, CSS, JavaScript",
          "Motivation et curiosité",
          "Première expérience appréciée",
        ],
        responsibilities: [
          "Participer au développement d'applications",
          "Apprendre les bonnes pratiques",
          "Contribuer aux projets d'équipe",
          "Documenter le code",
        ],
        benefits: [
          "Encadrement personnalisé",
          "Formation technique",
          "Possibilité d'embauche",
          "Environnement moderne",
        ],
        location: "Lyon",
        contractType: "Stage",
        salary: {
          min: 600,
          max: 800,
          currency: "EUR",
          isVisible: true,
        },
        department: departments[1]._id, // IT
        publicationDate: now,
        closingDate: futureDate,
        isActive: true,
        viewsCount: 234,
        createdBy: users[1]._id, // Pierre Martin
      },
      {
        title: "Commercial B2B Senior",
        description: "Développez notre portefeuille client entreprise et atteignez vos objectifs ambitieux.",
        requirements: [
          "Minimum 5 ans d'expérience en vente B2B",
          "Excellent relationnel",
          "Maîtrise des outils CRM",
          "Permis B obligatoire",
        ],
        responsibilities: [
          "Prospecter de nouveaux clients",
          "Négocier les contrats",
          "Fidéliser le portefeuille existant",
          "Atteindre les objectifs de vente",
        ],
        benefits: ["Commissions attractives", "Voiture de fonction", "Téléphone professionnel", "Évolution rapide"],
        location: "Marseille",
        contractType: "CDI",
        salary: {
          min: 40000,
          max: 70000,
          currency: "EUR",
          isVisible: false,
        },
        department: departments[2]._id, // Commercial
        publicationDate: now,
        closingDate: futureDate,
        isActive: true,
        viewsCount: 67,
        createdBy: users[2]._id, // Sophie Bernard
      },
      {
        title: "Comptable Senior",
        description: "Poste en CDD pour remplacement congé maternité. Rejoignez notre équipe finance.",
        requirements: [
          "Diplôme en comptabilité/finance",
          "3+ ans d'expérience",
          "Maîtrise des logiciels comptables",
          "Rigueur et autonomie",
        ],
        responsibilities: [
          "Tenir la comptabilité générale",
          "Préparer les déclarations fiscales",
          "Analyser les écarts budgétaires",
          "Assister aux clôtures mensuelles",
        ],
        benefits: ["Horaires flexibles", "Équipe expérimentée", "Formation continue", "Possibilité de CDI"],
        location: "Lille",
        contractType: "CDD",
        salary: {
          min: 32000,
          max: 38000,
          currency: "EUR",
          isVisible: true,
        },
        department: departments[4]._id, // Finance
        publicationDate: pastDate,
        closingDate: pastDate, // Offre expirée
        isActive: false,
        viewsCount: 45,
        createdBy: users[0]._id, // Marie Dubois
      },
      {
        title: "UX/UI Designer",
        description: "Créez des expériences utilisateur exceptionnelles pour nos produits digitaux.",
        requirements: [
          "Portfolio démontrant vos compétences",
          "Maîtrise de Figma, Adobe Creative Suite",
          "2+ ans d'expérience en UX/UI",
          "Sensibilité aux tendances design",
        ],
        responsibilities: [
          "Concevoir les interfaces utilisateur",
          "Réaliser des tests utilisateurs",
          "Collaborer avec les développeurs",
          "Maintenir le design system",
        ],
        benefits: ["Matériel haut de gamme", "Liberté créative", "Formations design", "Équipe internationale"],
        location: "Paris",
        contractType: "CDI",
        salary: {
          min: 38000,
          max: 48000,
          currency: "EUR",
          isVisible: true,
        },
        department: departments[3]._id, // Marketing
        publicationDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // Future
        closingDate: futureDate,
        isActive: true,
        viewsCount: 12,
        createdBy: users[3]._id, // Thomas Petit
      },
    ])
    console.log(`✅ ${jobOffers.length} offres d'emploi créées`)

    // 4. Créer des candidatures
    console.log("📝 Création des candidatures...")
    const applications = []

    // Candidatures pour le poste de Développeur Full Stack
    const devApplications = await Application.insertMany([
      {
        jobOffer: jobOffers[0]._id,
        firstName: "Alexandre",
        lastName: "Dupont",
        email: "alexandre.dupont@email.com",
        phone: "+33 6 12 34 56 78",
        coverLetter:
          "Passionné par le développement web depuis plus de 6 ans, je souhaite rejoindre votre équipe pour contribuer à vos projets innovants. Mon expérience en React et Node.js me permettra d'être opérationnel rapidement.",
        portfolio: "https://alexandre-dupont.dev",
        linkedin: "https://linkedin.com/in/alexandre-dupont",
        github: "https://github.com/alex-dupont",
        status: "interview",
        rating: 4,
        notes: [
          {
            content: "Excellent profil technique, expérience solide en React",
            createdBy: users[1]._id,
            createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          },
          {
            content: "Portfolio impressionnant, projets variés et bien documentés",
            createdBy: users[4]._id,
            createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          },
        ],
        interviews: [
          {
            date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
            duration: 90,
            type: "video",
            location: "Teams",
            interviewers: [users[1]._id],
            notes: "Entretien technique prévu",
            status: "scheduled",
          },
        ],
      },
      {
        jobOffer: jobOffers[0]._id,
        firstName: "Camille",
        lastName: "Rousseau",
        email: "camille.rousseau@email.com",
        phone: "+33 6 23 45 67 89",
        coverLetter:
          "Développeuse full stack avec 4 ans d'expérience, je recherche de nouveaux défis techniques. Votre annonce correspond parfaitement à mes aspirations professionnelles.",
        linkedin: "https://linkedin.com/in/camille-rousseau",
        github: "https://github.com/camille-dev",
        status: "reviewing",
        rating: 3,
        notes: [
          {
            content: "Profil intéressant mais manque d'expérience en MongoDB",
            createdBy: users[1]._id,
            createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          },
        ],
      },
      {
        jobOffer: jobOffers[0]._id,
        firstName: "Julien",
        lastName: "Moreau",
        email: "julien.moreau@email.com",
        phone: "+33 6 34 56 78 90",
        coverLetter:
          "Fort de mes 7 ans d'expérience en développement, je souhaite apporter mon expertise à votre équipe et participer à l'encadrement des développeurs juniors.",
        portfolio: "https://julien-moreau.com",
        linkedin: "https://linkedin.com/in/julien-moreau-dev",
        status: "hired",
        rating: 5,
        notes: [
          {
            content: "Candidat exceptionnel, embauche recommandée",
            createdBy: users[1]._id,
            createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          },
          {
            content: "Entretien excellent, très bonnes références",
            createdBy: users[0]._id,
            createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          },
        ],
        interviews: [
          {
            date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            duration: 120,
            type: "inperson",
            location: "Bureau Lyon",
            interviewers: [users[1]._id, users[0]._id],
            notes: "Entretien très positif, candidat retenu",
            status: "completed",
          },
        ],
      },
    ])
    applications.push(...devApplications)

    // Candidatures pour le poste de Marketing Digital
    const marketingApplications = await Application.insertMany([
      {
        jobOffer: jobOffers[1]._id,
        firstName: "Emma",
        lastName: "Leroy",
        email: "emma.leroy@email.com",
        phone: "+33 6 45 67 89 01",
        coverLetter:
          "Spécialisée en marketing digital depuis 4 ans, j'ai géré des budgets publicitaires importants et obtenu d'excellents ROI. Je souhaite mettre mon expertise au service de votre croissance.",
        linkedin: "https://linkedin.com/in/emma-leroy-marketing",
        status: "received",
        rating: 0,
      },
      {
        jobOffer: jobOffers[1]._id,
        firstName: "Lucas",
        lastName: "Girard",
        email: "lucas.girard@email.com",
        phone: "+33 6 56 78 90 12",
        coverLetter:
          "Passionné par le marketing digital et les nouvelles technologies, je souhaite rejoindre une équipe dynamique pour développer mes compétences.",
        status: "rejected",
        rating: 2,
        notes: [
          {
            content: "Manque d'expérience pour le poste senior",
            createdBy: users[3]._id,
            createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    ])
    applications.push(...marketingApplications)

    // Candidatures pour le stage développeur
    const stageApplications = await Application.insertMany([
      {
        jobOffer: jobOffers[2]._id,
        firstName: "Léa",
        lastName: "Dubois",
        email: "lea.dubois@student.com",
        phone: "+33 6 67 78 90 23",
        coverLetter:
          "Étudiante en 4ème année d'informatique, je recherche un stage pour mettre en pratique mes connaissances théoriques et découvrir le monde professionnel.",
        github: "https://github.com/lea-dubois",
        status: "interview",
        rating: 4,
        interviews: [
          {
            date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            duration: 60,
            type: "video",
            location: "Teams",
            interviewers: [users[1]._id, users[4]._id],
            status: "scheduled",
          },
        ],
      },
      {
        jobOffer: jobOffers[2]._id,
        firstName: "Hugo",
        lastName: "Martin",
        email: "hugo.martin@student.com",
        phone: "+33 6 78 90 12 34",
        coverLetter:
          "Étudiant motivé en informatique, j'ai réalisé plusieurs projets personnels et souhaite acquérir une expérience professionnelle enrichissante.",
        github: "https://github.com/hugo-martin",
        status: "reviewing",
        rating: 3,
      },
    ])
    applications.push(...stageApplications)

    // Candidatures pour le poste commercial
    const commercialApplications = await Application.insertMany([
      {
        jobOffer: jobOffers[3]._id,
        firstName: "Sarah",
        lastName: "Blanc",
        email: "sarah.blanc@email.com",
        phone: "+33 6 89 01 23 45",
        coverLetter:
          "Commerciale B2B expérimentée avec 6 ans d'expérience, j'ai toujours dépassé mes objectifs de vente. Je souhaite rejoindre votre équipe pour contribuer à votre développement.",
        linkedin: "https://linkedin.com/in/sarah-blanc-commercial",
        status: "interview",
        rating: 4,
        interviews: [
          {
            date: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
            duration: 90,
            type: "inperson",
            location: "Bureau Marseille",
            interviewers: [users[2]._id],
            status: "scheduled",
          },
        ],
      },
    ])
    applications.push(...commercialApplications)

    console.log(`✅ ${applications.length} candidatures créées`)

    // 5. Mettre à jour les managers des départements
    console.log("👔 Attribution des managers aux départements...")
    await Department.findByIdAndUpdate(departments[0]._id, { manager: users[0]._id }) // Marie -> RH
    await Department.findByIdAndUpdate(departments[1]._id, { manager: users[1]._id }) // Pierre -> IT
    await Department.findByIdAndUpdate(departments[2]._id, { manager: users[2]._id }) // Sophie -> Commercial
    await Department.findByIdAndUpdate(departments[3]._id, { manager: users[3]._id }) // Thomas -> Marketing

    // 6. Statistiques finales
    console.log("\n📊 RÉSUMÉ DES DONNÉES CRÉÉES:")
    console.log(`• ${departments.length} départements`)
    console.log(`• ${users.length} utilisateurs`)
    console.log(`• ${jobOffers.length} offres d'emploi`)
    console.log(`• ${applications.length} candidatures`)

    console.log("\n📈 RÉPARTITION DES CANDIDATURES PAR STATUT:")
    const statusCounts = await Application.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    statusCounts.forEach((stat) => {
      console.log(`• ${stat._id}: ${stat.count} candidature(s)`)
    })

    console.log("\n🎯 OFFRES D'EMPLOI PAR STATUT:")
    const activeOffers = await JobOffer.countDocuments({ isActive: true, closingDate: { $gte: now } })
    const expiredOffers = await JobOffer.countDocuments({ closingDate: { $lt: now } })
    const futureOffers = await JobOffer.countDocuments({ publicationDate: { $gt: now } })
    console.log(`• Actives: ${activeOffers}`)
    console.log(`• Expirées: ${expiredOffers}`)
    console.log(`• Programmées: ${futureOffers}`)

    console.log("\n✅ Seeding terminé avec succès!")
    console.log("\n🔐 COMPTES DE TEST CRÉÉS:")
    console.log("• marie.dubois@company.com (Admin RH) - password: password123")
    console.log("• pierre.martin@company.com (Manager IT) - password: password123")
    console.log("• sophie.bernard@company.com (Manager Commercial) - password: password123")
    console.log("• thomas.petit@company.com (Manager Marketing) - password: password123")
    console.log("• julie.moreau@company.com (Chargée recrutement) - password: password123")

    console.log("\n🎯 PROCHAINES ÉTAPES:")
    console.log("1. Connectez-vous avec un des comptes ci-dessus")
    console.log("2. Testez la création d'offres d'emploi")
    console.log("3. Consultez les candidatures reçues")
    console.log("4. Planifiez des entretiens")
    console.log("5. Consultez les statistiques de recrutement")
  } catch (error) {
    console.error("❌ Erreur lors du seeding:", error)
  } finally {
    await mongoose.disconnect()
    console.log("🔌 Déconnexion de MongoDB")
  }
}

// Exécuter le script
seedRecruitmentData()
