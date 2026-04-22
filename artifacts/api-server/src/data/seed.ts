// KONTi Design | Build Studio — Static Seed Data for MVP Demo

export const USERS = [
  {
    id: "user-1",
    name: "Carla Gautier",
    email: "demo@konti.com",
    role: "admin" as const,
    avatar: "CG",
    password: "konti2026",
  },
  {
    id: "user-2",
    name: "Michelle Telon Sosa",
    email: "michelle@konti.com",
    role: "architect" as const,
    avatar: "MT",
    password: "konti2026",
  },
  {
    id: "user-client-1",
    name: "Benito Antonio Martínez Ocasio",
    email: "client@konti.com",
    role: "client" as const,
    avatar: "BA",
    password: "konti2026",
  },
  {
    id: "user-super-1",
    name: "Tatiana",
    email: "tatiana@menatech.cloud",
    role: "superadmin" as const,
    avatar: "TM",
    password: "Konti123",
  },
  {
    id: "user-super-2",
    name: "Gonzalo",
    email: "gonzalo@menatech.cloud",
    role: "superadmin" as const,
    avatar: "GM",
    password: "Konti123",
  },
];

export const PROJECTS = [
  {
    id: "proj-1",
    name: "Casa Solar Rincón",
    nameEs: "Casa Solar Rincón",
    clientName: "Rafael Medina Torres",
    location: "Rincón, Puerto Rico",
    city: "Rincón",
    phase: "consultation" as "discovery" | "consultation" | "pre_design" | "schematic_design" | "design_development" | "construction_documents" | "permits" | "construction" | "completed",
    phaseLabel: "Consultation",
    phaseLabelEs: "Consulta Inicial",
    phaseNumber: 2,
    progressPercent: 18,
    budgetAllocated: 280000,
    budgetUsed: 12500,
    startDate: "2026-03-15",
    estimatedEndDate: "2027-06-30",
    description:
      "Off-grid solar-powered container home on a hilltop lot with panoramic Atlantic views. Client seeks a 3-bedroom, 2-bath sustainable residence using 2×40ft shipping containers with rainwater collection and photovoltaic panels.",
    coverImage: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800&auto=format&fit=crop",
    asanaGid: "1234567890001",
    gammaReportUrl: "/projects/proj-1/report",
    teamMembers: ["Carla Gautier", "Michelle Telon Sosa", "Jorge Rosa"],
    status: "active" as const,
  },
  {
    id: "proj-2",
    name: "Residencia Martínez Ocasio – Bad Bunny",
    nameEs: "Residencia Martínez Ocasio – Bad Bunny",
    clientName: "Benito Antonio Martínez Ocasio",
    location: "Vega Alta, Puerto Rico",
    city: "Vega Alta",
    phase: "construction" as const,
    phaseLabel: "Construction",
    phaseLabelEs: "Construcción",
    phaseNumber: 8,
    progressPercent: 67,
    budgetAllocated: 400000,
    budgetUsed: 178235,
    startDate: "2025-08-01",
    estimatedEndDate: "2026-09-15",
    description:
      "Luxury 4-bedroom container residence with infinity pool, home studio, and rooftop terrace. Three 40ft containers configured in a U-shape around a central courtyard. LEED-certified materials throughout.",
    coverImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop",
    asanaGid: "1234567890002",
    gammaReportUrl: "/projects/proj-2/report",
    teamMembers: ["Carla Gautier", "Michelle Telon Sosa", "Andrea Camacho", "Jorge Rosa"],
    status: "active" as const,
  },
  {
    id: "proj-3",
    name: "Café Colmado Santurce",
    nameEs: "Café Colmado Santurce",
    clientName: "Lucía Ferrer Alicea",
    location: "Santurce, San Juan, Puerto Rico",
    city: "San Juan",
    phase: "completed" as const,
    phaseLabel: "Completed",
    phaseLabelEs: "Completado",
    phaseNumber: 9,
    progressPercent: 100,
    budgetAllocated: 165000,
    budgetUsed: 158900,
    startDate: "2025-01-10",
    estimatedEndDate: "2025-11-30",
    description:
      "Mixed-use café and colmado (neighborhood grocery) in the heart of Santurce's arts district. Two 20ft containers with a custom steel pergola and open-air terrace. Opened November 2025.",
    coverImage: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop",
    asanaGid: "1234567890003",
    gammaReportUrl: "/projects/proj-3/report",
    teamMembers: ["Carla Gautier", "Michelle Telon Sosa", "Miranda Klopf"],
    status: "completed" as const,
  },
];

export const PROJECT_TASKS = {
  "proj-1": [
    {
      id: "task-1-1",
      projectId: "proj-1",
      title: "Schedule site visit to Rincón lot",
      titleEs: "Coordinar visita al terreno en Rincón",
      dueDate: "2026-04-22",
      completed: true,
      assignee: "Jorge Rosa",
      priority: "high" as const,
      phase: "discovery",
    },
    {
      id: "task-1-2",
      projectId: "proj-1",
      title: "Complete topographical survey",
      titleEs: "Completar levantamiento topográfico",
      dueDate: "2026-04-30",
      completed: true,
      assignee: "Jorge Rosa",
      priority: "high" as const,
      phase: "discovery",
    },
    {
      id: "task-1-3",
      projectId: "proj-1",
      title: "Submit Pre-Design & Viability Study invoice",
      titleEs: "Enviar factura del Pre-Design & Viability Study",
      dueDate: "2026-05-05",
      completed: false,
      assignee: "Carla Gautier",
      priority: "high" as const,
      phase: "discovery",
    },
    {
      id: "task-1-4",
      projectId: "proj-1",
      title: "Prepare 3 layout options for client review",
      titleEs: "Preparar 3 opciones de layout para revisión del cliente",
      dueDate: "2026-05-15",
      completed: false,
      assignee: "Michelle Telon Sosa",
      priority: "medium" as const,
      phase: "pre_design",
    },
    {
      id: "task-1-5",
      projectId: "proj-1",
      title: "Analyze municipal zoning regulations",
      titleEs: "Analizar regulaciones de zonificación municipal",
      dueDate: "2026-05-20",
      completed: false,
      assignee: "Andrea Camacho",
      priority: "medium" as const,
      phase: "pre_design",
    },
    {
      id: "task-1-6",
      projectId: "proj-1",
      title: "Generate Gamma progress presentation for client",
      titleEs: "Generar presentación de progreso en Gamma para el cliente",
      dueDate: "2026-05-25",
      completed: false,
      assignee: "Miranda Klopf",
      priority: "low" as const,
      phase: "discovery",
    },
  ],
  "proj-2": [
    {
      id: "task-2-1",
      projectId: "proj-2",
      title: "Order roofing materials — Lot B",
      titleEs: "Ordenar materiales de techo — Lote B",
      dueDate: "2026-04-18",
      completed: true,
      assignee: "Jorge Rosa",
      priority: "high" as const,
      phase: "construction",
    },
    {
      id: "task-2-2",
      projectId: "proj-2",
      title: "Framing inspection — Container 2",
      titleEs: "Inspección de estructura — Contenedor 2",
      dueDate: "2026-04-20",
      completed: true,
      assignee: "Andrea Camacho",
      priority: "high" as const,
      phase: "construction",
    },
    {
      id: "task-2-3",
      projectId: "proj-2",
      title: "Finalize bathroom tiling — Master Bath",
      titleEs: "Finalizar azulejos del baño principal",
      dueDate: "2026-04-28",
      completed: false,
      assignee: "Jorge Rosa",
      priority: "medium" as const,
      phase: "construction",
    },
    {
      id: "task-2-4",
      projectId: "proj-2",
      title: "Install electrical panel and circuits",
      titleEs: "Instalar panel eléctrico y circuitos",
      dueDate: "2026-05-02",
      completed: false,
      assignee: "Subcontractor — Eléctrico PR",
      priority: "high" as const,
      phase: "construction",
    },
    {
      id: "task-2-5",
      projectId: "proj-2",
      title: "Pool excavation and foundation pour",
      titleEs: "Excavación de piscina y fundición",
      dueDate: "2026-05-10",
      completed: false,
      assignee: "Jorge Rosa",
      priority: "high" as const,
      phase: "construction",
    },
    {
      id: "task-2-6",
      projectId: "proj-2",
      title: "Send weekly construction report to client",
      titleEs: "Enviar reporte semanal de construcción al cliente",
      dueDate: "2026-04-17",
      completed: false,
      assignee: "Miranda Klopf",
      priority: "medium" as const,
      phase: "construction",
    },
  ],
  "proj-3": [
    {
      id: "task-3-1",
      projectId: "proj-3",
      title: "Final walkthrough and punch list completion",
      titleEs: "Recorrido final y cierre de punch list",
      dueDate: "2025-11-20",
      completed: true,
      assignee: "Jorge Rosa",
      priority: "high" as const,
      phase: "completed",
    },
    {
      id: "task-3-2",
      projectId: "proj-3",
      title: "Deliver final as-built drawings to client",
      titleEs: "Entregar planos finales as-built al cliente",
      dueDate: "2025-11-25",
      completed: true,
      assignee: "Michelle Telon Sosa",
      priority: "high" as const,
      phase: "completed",
    },
    {
      id: "task-3-3",
      projectId: "proj-3",
      title: "Certificate of Occupancy obtained",
      titleEs: "Certificado de ocupación obtenido",
      dueDate: "2025-11-28",
      completed: true,
      assignee: "Andrea Camacho",
      priority: "high" as const,
      phase: "completed",
    },
    {
      id: "task-3-4",
      projectId: "proj-3",
      title: "Final invoice and project closeout",
      titleEs: "Factura final y cierre de proyecto",
      dueDate: "2025-12-01",
      completed: true,
      assignee: "Carla Gautier",
      priority: "high" as const,
      phase: "completed",
    },
  ],
};

export const WEATHER_DATA = {
  "proj-1": {
    projectId: "proj-1",
    city: "Rincón, PR",
    temperature: 84,
    temperatureUnit: "°F",
    condition: "Partly Cloudy",
    conditionEs: "Parcialmente Nublado",
    humidity: 72,
    windSpeed: 12,
    windUnit: "mph",
    buildSuitability: "green" as const,
    buildSuitabilityLabel: "Good for Work",
    buildSuitabilityLabelEs: "Buenas Condiciones",
    buildSuitabilityReason: "Mild wind and no precipitation expected. Safe for site surveys and foundation work.",
    buildSuitabilityReasonEs: "Viento moderado sin precipitación esperada. Seguro para visitas al sitio y trabajos de fundación.",
    lastUpdated: new Date().toISOString(),
    weatherHistory: [
      { date: "2026-04-09", dayLabel: "Wed", dayLabelEs: "Mié", tempHigh: 86, tempLow: 74, precipMm: 0, condition: "Sunny", conditionEs: "Soleado", emoji: "☀️" },
      { date: "2026-04-10", dayLabel: "Thu", dayLabelEs: "Jue", tempHigh: 85, tempLow: 73, precipMm: 2, condition: "Partly Cloudy", conditionEs: "Parcialmente Nublado", emoji: "⛅" },
      { date: "2026-04-11", dayLabel: "Fri", dayLabelEs: "Vie", tempHigh: 87, tempLow: 75, precipMm: 0, condition: "Sunny", conditionEs: "Soleado", emoji: "☀️" },
      { date: "2026-04-12", dayLabel: "Sat", dayLabelEs: "Sáb", tempHigh: 83, tempLow: 72, precipMm: 12, condition: "Light Showers", conditionEs: "Llovizna", emoji: "🌦️" },
      { date: "2026-04-13", dayLabel: "Sun", dayLabelEs: "Dom", tempHigh: 82, tempLow: 70, precipMm: 6, condition: "Cloudy", conditionEs: "Nublado", emoji: "☁️" },
      { date: "2026-04-14", dayLabel: "Mon", dayLabelEs: "Lun", tempHigh: 84, tempLow: 73, precipMm: 1, condition: "Partly Cloudy", conditionEs: "Parcialmente Nublado", emoji: "⛅" },
      { date: "2026-04-15", dayLabel: "Tue", dayLabelEs: "Mar", tempHigh: 84, tempLow: 72, precipMm: 0, condition: "Partly Cloudy", conditionEs: "Parcialmente Nublado", emoji: "⛅" },
    ],
  },
  "proj-2": {
    projectId: "proj-2",
    city: "Vega Alta, PR",
    temperature: 87,
    temperatureUnit: "°F",
    condition: "Scattered Showers",
    conditionEs: "Chubascos Dispersos",
    humidity: 89,
    windSpeed: 18,
    windUnit: "mph",
    buildSuitability: "yellow" as const,
    buildSuitabilityLabel: "Proceed with Caution",
    buildSuitabilityLabelEs: "Proceder con Precaución",
    buildSuitabilityReason: "Afternoon showers expected. Interior work OK. Delay concrete pours and roofing.",
    buildSuitabilityReasonEs: "Chubascos esperados por la tarde. Trabajo interior permitido. Evitar fundición de concreto y techado.",
    lastUpdated: new Date().toISOString(),
    weatherHistory: [
      { date: "2026-04-09", dayLabel: "Wed", dayLabelEs: "Mié", tempHigh: 87, tempLow: 75, precipMm: 3, condition: "Partly Cloudy", conditionEs: "Parcialmente Nublado", emoji: "⛅" },
      { date: "2026-04-10", dayLabel: "Thu", dayLabelEs: "Jue", tempHigh: 85, tempLow: 74, precipMm: 18, condition: "Scattered Showers", conditionEs: "Chubascos Dispersos", emoji: "🌦️" },
      { date: "2026-04-11", dayLabel: "Fri", dayLabelEs: "Vie", tempHigh: 82, tempLow: 73, precipMm: 28, condition: "Heavy Showers", conditionEs: "Chubascos Fuertes", emoji: "🌧️" },
      { date: "2026-04-12", dayLabel: "Sat", dayLabelEs: "Sáb", tempHigh: 84, tempLow: 73, precipMm: 8, condition: "Overcast", conditionEs: "Cielo Cubierto", emoji: "☁️" },
      { date: "2026-04-13", dayLabel: "Sun", dayLabelEs: "Dom", tempHigh: 86, tempLow: 74, precipMm: 2, condition: "Partly Cloudy", conditionEs: "Parcialmente Nublado", emoji: "⛅" },
      { date: "2026-04-14", dayLabel: "Mon", dayLabelEs: "Lun", tempHigh: 88, tempLow: 75, precipMm: 0, condition: "Sunny", conditionEs: "Soleado", emoji: "☀️" },
      { date: "2026-04-15", dayLabel: "Tue", dayLabelEs: "Mar", tempHigh: 87, tempLow: 75, precipMm: 14, condition: "Scattered Showers", conditionEs: "Chubascos Dispersos", emoji: "🌦️" },
    ],
  },
  "proj-3": {
    projectId: "proj-3",
    city: "San Juan, PR",
    temperature: 82,
    temperatureUnit: "°F",
    condition: "Sunny",
    conditionEs: "Soleado",
    humidity: 65,
    windSpeed: 8,
    windUnit: "mph",
    buildSuitability: "green" as const,
    buildSuitabilityLabel: "Excellent Conditions",
    buildSuitabilityLabelEs: "Condiciones Excelentes",
    buildSuitabilityReason: "Project completed. Clear skies and low humidity — ideal for final exterior photography.",
    buildSuitabilityReasonEs: "Proyecto completado. Cielos despejados y baja humedad — ideal para fotografía exterior.",
    lastUpdated: new Date().toISOString(),
    weatherHistory: [
      { date: "2026-04-09", dayLabel: "Wed", dayLabelEs: "Mié", tempHigh: 83, tempLow: 72, precipMm: 0, condition: "Sunny", conditionEs: "Soleado", emoji: "☀️" },
      { date: "2026-04-10", dayLabel: "Thu", dayLabelEs: "Jue", tempHigh: 84, tempLow: 73, precipMm: 0, condition: "Sunny", conditionEs: "Soleado", emoji: "☀️" },
      { date: "2026-04-11", dayLabel: "Fri", dayLabelEs: "Vie", tempHigh: 83, tempLow: 72, precipMm: 1, condition: "Partly Cloudy", conditionEs: "Parcialmente Nublado", emoji: "⛅" },
      { date: "2026-04-12", dayLabel: "Sat", dayLabelEs: "Sáb", tempHigh: 81, tempLow: 71, precipMm: 8, condition: "Light Showers", conditionEs: "Llovizna", emoji: "🌦️" },
      { date: "2026-04-13", dayLabel: "Sun", dayLabelEs: "Dom", tempHigh: 82, tempLow: 71, precipMm: 2, condition: "Partly Cloudy", conditionEs: "Parcialmente Nublado", emoji: "⛅" },
      { date: "2026-04-14", dayLabel: "Mon", dayLabelEs: "Lun", tempHigh: 83, tempLow: 72, precipMm: 0, condition: "Sunny", conditionEs: "Soleado", emoji: "☀️" },
      { date: "2026-04-15", dayLabel: "Tue", dayLabelEs: "Mar", tempHigh: 82, tempLow: 71, precipMm: 0, condition: "Sunny", conditionEs: "Soleado", emoji: "☀️" },
    ],
  },
};

export const DOCUMENTS = {
  "proj-1": [
    {
      id: "doc-1-1",
      projectId: "proj-1",
      name: "Pre-Design Questionnaire — Medina Torres",
      type: "pdf" as const,
      category: "client_review" as const,
      isClientVisible: true,
      uploadedBy: "Carla Gautier",
      uploadedAt: "2026-03-28T10:00:00Z",
      fileSize: "1.4 MB",
      description: "Initial client intake questionnaire with project goals and budget parameters.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Carla Gautier", uploadedAt: "2026-03-20T10:00:00Z", fileSize: "1.2 MB", notes: "Initial draft sent to client for review.", notesEs: "Borrador inicial enviado al cliente para revisión." },
        { version: 2, uploadedBy: "Carla Gautier", uploadedAt: "2026-03-28T10:00:00Z", fileSize: "1.4 MB", notes: "Updated with client feedback on budget and timeline.", notesEs: "Actualizado con comentarios del cliente sobre presupuesto y cronograma." },
      ],
    },
    {
      id: "doc-1-2",
      projectId: "proj-1",
      name: "Site Photos — Rincón Hilltop Lot",
      type: "photo" as const,
      category: "construction" as const,
      isClientVisible: true,
      uploadedBy: "Jorge Rosa",
      uploadedAt: "2026-04-02T14:30:00Z",
      fileSize: "48.5 MB",
      description: "360° site photos and GPS-tagged reference shots.",
      previewable: false,
      versions: [
        { version: 1, uploadedBy: "Jorge Rosa", uploadedAt: "2026-04-02T14:30:00Z", fileSize: "48.5 MB", notes: "Initial site visit documentation.", notesEs: "Documentación de la primera visita al sitio." },
      ],
    },
    {
      id: "doc-1-3",
      projectId: "proj-1",
      name: "Topographical Survey Report",
      type: "pdf" as const,
      category: "internal" as const,
      isClientVisible: false,
      uploadedBy: "Jorge Rosa",
      uploadedAt: "2026-04-10T09:15:00Z",
      fileSize: "3.8 MB",
      description: "Full topographical survey with elevation contours and soil analysis.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Jorge Rosa", uploadedAt: "2026-04-10T09:15:00Z", fileSize: "3.8 MB", notes: "Certified survey — final version.", notesEs: "Levantamiento certificado — versión final." },
      ],
    },
    {
      id: "doc-1-4",
      projectId: "proj-1",
      name: "Zoning Analysis — Rincón Municipality",
      type: "pdf" as const,
      category: "permits" as const,
      isClientVisible: false,
      uploadedBy: "Andrea Camacho",
      uploadedAt: "2026-04-12T11:00:00Z",
      fileSize: "0.9 MB",
      description: "Municipal zoning regulations and setback requirements for residential container structures.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Andrea Camacho", uploadedAt: "2026-04-12T11:00:00Z", fileSize: "0.9 MB", notes: "Zoning code analysis — pending ARPE confirmation.", notesEs: "Análisis de código de zonificación — pendiente confirmación de ARPE." },
      ],
    },
  ],
  "proj-2": [
    {
      id: "doc-2-1",
      projectId: "proj-2",
      name: "Construction Estimate — Martínez Ocasio",
      type: "excel" as const,
      category: "client_review" as const,
      designSubPhase: "construction_documents" as const,
      isClientVisible: true,
      uploadedBy: "Carla Gautier",
      uploadedAt: "2025-10-15T09:00:00Z",
      fileSize: "2.4 MB",
      description: "Detailed cost-plus construction estimate with material breakdown.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Carla Gautier", uploadedAt: "2025-08-22T09:00:00Z", fileSize: "1.8 MB", notes: "Initial estimate — preliminary scope.", notesEs: "Estimado inicial — alcance preliminar." },
        { version: 2, uploadedBy: "Carla Gautier", uploadedAt: "2025-09-01T09:00:00Z", fileSize: "2.1 MB", notes: "Updated with pool and home studio scope.", notesEs: "Actualizado con alcance de piscina y estudio de música." },
        { version: 3, uploadedBy: "Carla Gautier", uploadedAt: "2025-10-15T09:00:00Z", fileSize: "2.4 MB", notes: "Final signed estimate — client approved.", notesEs: "Estimado final firmado — aprobado por cliente." },
      ],
    },
    {
      id: "doc-2-2",
      projectId: "proj-2",
      name: "Weekly Progress Report — Week 32",
      type: "pdf" as const,
      category: "client_review" as const,
      isClientVisible: true,
      uploadedBy: "Miranda Klopf",
      uploadedAt: "2026-04-14T16:00:00Z",
      fileSize: "4.2 MB",
      description: "Photo-documented progress report with completed tasks and upcoming milestones.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Miranda Klopf", uploadedAt: "2026-04-14T12:00:00Z", fileSize: "3.9 MB", notes: "Draft — pending photo additions.", notesEs: "Borrador — pendiente de agregar fotos." },
        { version: 2, uploadedBy: "Miranda Klopf", uploadedAt: "2026-04-14T16:00:00Z", fileSize: "4.2 MB", notes: "Final — photos added and formatting updated.", notesEs: "Final — fotos agregadas y formato actualizado." },
      ],
    },
    {
      id: "doc-2-3",
      projectId: "proj-2",
      name: "OGPE Permit Set — Approved",
      type: "pdf" as const,
      category: "permits" as const,
      isClientVisible: false,
      uploadedBy: "Andrea Camacho",
      uploadedAt: "2026-01-15T10:30:00Z",
      fileSize: "18.7 MB",
      description: "Complete approved permit package from OGPE including structural, electrical, and plumbing.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Andrea Camacho", uploadedAt: "2025-11-05T10:00:00Z", fileSize: "16.2 MB", notes: "First submission — awaiting OGPE review.", notesEs: "Primera presentación — en revisión OGPE." },
        { version: 2, uploadedBy: "Andrea Camacho", uploadedAt: "2025-12-18T14:00:00Z", fileSize: "17.5 MB", notes: "Revised per OGPE comments — structural addendum added.", notesEs: "Revisado según comentarios de OGPE — addendum estructural agregado." },
        { version: 3, uploadedBy: "Andrea Camacho", uploadedAt: "2026-01-15T10:30:00Z", fileSize: "18.7 MB", notes: "Final approved set — stamp received.", notesEs: "Juego aprobado final — sello recibido." },
      ],
    },
    {
      id: "doc-2-4",
      projectId: "proj-2",
      name: "Contractor Monitoring Report — April 2026",
      type: "excel" as const,
      category: "internal" as const,
      isClientVisible: false,
      uploadedBy: "Jorge Rosa",
      uploadedAt: "2026-04-13T17:00:00Z",
      fileSize: "1.5 MB",
      description: "Internal contractor hours tracking and performance monitoring spreadsheet.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Jorge Rosa", uploadedAt: "2026-04-13T17:00:00Z", fileSize: "1.5 MB", notes: "Monthly report — April 2026.", notesEs: "Reporte mensual — Abril 2026." },
      ],
    },
    {
      id: "doc-2-5",
      projectId: "proj-2",
      name: "Structural Engineering Specs — Steel Frame",
      type: "pdf" as const,
      category: "design" as const,
      designSubPhase: "design_development" as const,
      isClientVisible: false,
      uploadedBy: "Michelle Telon Sosa",
      uploadedAt: "2025-10-20T11:00:00Z",
      fileSize: "8.3 MB",
      description: "Structural engineering specifications for the welded steel frame connecting the three containers.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-09-12T11:00:00Z", fileSize: "7.1 MB", notes: "Preliminary structural design.", notesEs: "Diseño estructural preliminar." },
        { version: 2, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-10-20T11:00:00Z", fileSize: "8.3 MB", notes: "Final PE-stamped specifications.", notesEs: "Especificaciones finales con sello de ingeniero." },
      ],
    },
    {
      id: "doc-2-6",
      projectId: "proj-2",
      name: "Interior Design Presentation",
      type: "pptx" as const,
      category: "client_review" as const,
      designSubPhase: "design_development" as const,
      isClientVisible: true,
      uploadedBy: "Michelle Telon Sosa",
      uploadedAt: "2026-02-28T14:00:00Z",
      fileSize: "22.4 MB",
      description: "Final approved interior design presentation including finishes, fixtures, and furniture layout.",
      previewable: false,
      versions: [
        { version: 1, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-12-05T14:00:00Z", fileSize: "18.1 MB", notes: "Initial concept presentation — 3 material boards.", notesEs: "Presentación de concepto inicial — 3 tableros de materiales." },
        { version: 2, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2026-01-22T14:00:00Z", fileSize: "20.6 MB", notes: "Revised per client selections — furniture added.", notesEs: "Revisado según selecciones del cliente — mobiliario agregado." },
        { version: 3, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2026-02-28T14:00:00Z", fileSize: "22.4 MB", notes: "Final approved — all finishes confirmed.", notesEs: "Final aprobado — todos los acabados confirmados." },
      ],
    },
    {
      id: "doc-2-7",
      projectId: "proj-2",
      name: "Punch List — Phase 4 Completion",
      type: "excel" as const,
      category: "internal" as const,
      isClientVisible: false,
      uploadedBy: "Jorge Rosa",
      uploadedAt: "2026-04-01T08:30:00Z",
      fileSize: "0.8 MB",
      description: "Detailed punch list for Phase 4 closeout — 94% items resolved.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Jorge Rosa", uploadedAt: "2026-04-01T08:30:00Z", fileSize: "0.8 MB", notes: "Punch list — 94% resolved.", notesEs: "Punch list — 94% resuelto." },
      ],
    },
    {
      id: "doc-2-8",
      projectId: "proj-2",
      name: "Site Construction Photos — April 2026",
      type: "photo" as const,
      category: "construction" as const,
      isClientVisible: true,
      uploadedBy: "Jorge Rosa",
      uploadedAt: "2026-04-12T15:00:00Z",
      fileSize: "95.2 MB",
      description: "Weekly site photo documentation including framing, electrical rough-in, and pool excavation.",
      previewable: false,
      versions: [
        { version: 1, uploadedBy: "Jorge Rosa", uploadedAt: "2026-04-05T15:00:00Z", fileSize: "68.4 MB", notes: "Week 31 site photos.", notesEs: "Fotos del sitio semana 31." },
        { version: 2, uploadedBy: "Jorge Rosa", uploadedAt: "2026-04-12T15:00:00Z", fileSize: "95.2 MB", notes: "Week 32 — framing and electrical rough-in added.", notesEs: "Semana 32 — estructura y electricidad rough-in agregados." },
      ],
    },
    {
      id: "doc-2-9",
      projectId: "proj-2",
      name: "Schematic Design — Floorplan Concepts",
      type: "pdf" as const,
      category: "design" as const,
      designSubPhase: "schematic_design" as const,
      isClientVisible: true,
      uploadedBy: "Michelle Telon Sosa",
      uploadedAt: "2025-08-12T10:00:00Z",
      fileSize: "6.4 MB",
      description: "Schematic floorplans, massing studies and orientation options (SD up to V3).",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-07-10T10:00:00Z", fileSize: "5.1 MB", notes: "Initial concept — three orientation options.", notesEs: "Concepto inicial — tres opciones de orientación." },
        { version: 2, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-07-28T10:00:00Z", fileSize: "5.8 MB", notes: "Refined per client feedback — pool relocated.", notesEs: "Refinado según comentarios del cliente — piscina reubicada." },
        { version: 3, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-08-12T10:00:00Z", fileSize: "6.4 MB", notes: "SD final — approved for DD handoff.", notesEs: "SD final — aprobado para entrega DD." },
      ],
    },
    {
      id: "doc-2-10",
      projectId: "proj-2",
      name: "Construction Documents — Permit Set",
      type: "pdf" as const,
      category: "design" as const,
      designSubPhase: "construction_documents" as const,
      isClientVisible: false,
      uploadedBy: "Michelle Telon Sosa",
      uploadedAt: "2025-11-18T16:00:00Z",
      fileSize: "14.2 MB",
      description: "Full CD set for OGPE submission — sealed drawings, specs, schedules (CD up to V2).",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-11-04T16:00:00Z", fileSize: "13.5 MB", notes: "CD V1 — internal QA review.", notesEs: "CD V1 — revisión interna QA." },
        { version: 2, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-11-18T16:00:00Z", fileSize: "14.2 MB", notes: "CD V2 final — sealed and issued for permit.", notesEs: "CD V2 final — sellado y emitido para permiso." },
      ],
    },
  ],
  "proj-3": [
    {
      id: "doc-3-1",
      projectId: "proj-3",
      name: "Certificate of Occupancy — Café Colmado",
      type: "pdf" as const,
      category: "permits" as const,
      isClientVisible: true,
      uploadedBy: "Andrea Camacho",
      uploadedAt: "2025-11-28T10:00:00Z",
      fileSize: "0.4 MB",
      description: "Official ARPE Certificate of Occupancy for commercial use.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Andrea Camacho", uploadedAt: "2025-11-28T10:00:00Z", fileSize: "0.4 MB", notes: "Official CO — received from ARPE.", notesEs: "CO oficial — recibido de ARPE." },
      ],
    },
    {
      id: "doc-3-2",
      projectId: "proj-3",
      name: "As-Built Drawings — Full Set",
      type: "pdf" as const,
      category: "client_review" as const,
      isClientVisible: true,
      uploadedBy: "Michelle Telon Sosa",
      uploadedAt: "2025-11-25T14:00:00Z",
      fileSize: "31.6 MB",
      description: "Complete as-built drawing set including architectural, structural, MEP, and civil.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-11-10T14:00:00Z", fileSize: "29.2 MB", notes: "Draft as-built — field verification pending.", notesEs: "As-built borrador — verificación de campo pendiente." },
        { version: 2, uploadedBy: "Michelle Telon Sosa", uploadedAt: "2025-11-25T14:00:00Z", fileSize: "31.6 MB", notes: "Final as-built — all field revisions incorporated.", notesEs: "As-built final — todas las revisiones de campo incorporadas." },
      ],
    },
    {
      id: "doc-3-3",
      projectId: "proj-3",
      name: "Final Project Cost Report",
      type: "excel" as const,
      category: "client_review" as const,
      isClientVisible: true,
      uploadedBy: "Carla Gautier",
      uploadedAt: "2025-12-01T09:00:00Z",
      fileSize: "1.8 MB",
      description: "Final cost-plus reconciliation report. Total project came in 3.7% under initial estimate.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Carla Gautier", uploadedAt: "2025-11-20T09:00:00Z", fileSize: "1.5 MB", notes: "Draft reconciliation — pending final receipts.", notesEs: "Reconciliación borrador — pendiente recibos finales." },
        { version: 2, uploadedBy: "Carla Gautier", uploadedAt: "2025-12-01T09:00:00Z", fileSize: "1.8 MB", notes: "Final — 3.7% under estimate. Client signed.", notesEs: "Final — 3.7% por debajo del estimado. Firmado por cliente." },
      ],
    },
    {
      id: "doc-3-4",
      projectId: "proj-3",
      name: "Professional Photography — Grand Opening",
      type: "photo" as const,
      category: "client_review" as const,
      isClientVisible: true,
      uploadedBy: "Miranda Klopf",
      uploadedAt: "2025-12-05T12:00:00Z",
      fileSize: "287.4 MB",
      description: "Professional photography shoot for portfolio and client deliverable. 84 edited images.",
      previewable: false,
      versions: [
        { version: 1, uploadedBy: "Miranda Klopf", uploadedAt: "2025-12-05T12:00:00Z", fileSize: "287.4 MB", notes: "84 edited images — grand opening.", notesEs: "84 imágenes editadas — inauguración." },
      ],
    },
    {
      id: "doc-3-5",
      projectId: "proj-3",
      name: "Warranty Documentation & Maintenance Guide",
      type: "pdf" as const,
      category: "client_review" as const,
      isClientVisible: true,
      uploadedBy: "Jorge Rosa",
      uploadedAt: "2025-12-03T11:00:00Z",
      fileSize: "5.1 MB",
      description: "Complete warranty documentation and 5-year maintenance schedule for all systems.",
      previewable: true,
      versions: [
        { version: 1, uploadedBy: "Jorge Rosa", uploadedAt: "2025-12-03T11:00:00Z", fileSize: "5.1 MB", notes: "Final — 5-year maintenance schedule included.", notesEs: "Final — cronograma de mantenimiento de 5 años incluido." },
      ],
    },
  ],
};

export const MATERIALS = [
  // Steel / Foundation
  { id: "mat-1", item: "40ft Shipping Container (One-trip)", itemEs: "Contenedor 40ft (Un viaje)", unit: "unit", basePrice: 6800, category: "steel" as const },
  { id: "mat-2", item: "20ft Shipping Container (One-trip)", itemEs: "Contenedor 20ft (Un viaje)", unit: "unit", basePrice: 3900, category: "steel" as const },
  { id: "mat-3", item: "Concrete — Ready Mix (3000 PSI)", itemEs: "Concreto — Mezcla lista (3000 PSI)", unit: "yd³", basePrice: 165, category: "foundation" as const },
  { id: "mat-4", item: "Rebar #4 (20ft)", itemEs: "Varilla #4 (20ft)", unit: "each", basePrice: 14, category: "foundation" as const },
  { id: "mat-5", item: "Rebar #5 (20ft)", itemEs: "Varilla #5 (20ft)", unit: "each", basePrice: 19, category: "foundation" as const },
  { id: "mat-6", item: "Concrete Block 8\" (CMU)", itemEs: "Bloque de concreto 8\"", unit: "each", basePrice: 2.5, category: "foundation" as const },
  // Lumber
  { id: "mat-7", item: "Pressure Treated Lumber 2×4×8", itemEs: "Madera tratada 2×4×8", unit: "each", basePrice: 8.5, category: "lumber" as const },
  { id: "mat-8", item: "Pressure Treated Lumber 2×6×12", itemEs: "Madera tratada 2×6×12", unit: "each", basePrice: 16, category: "lumber" as const },
  { id: "mat-9", item: "Plywood 3/4\" CDX (4×8 sheet)", itemEs: "Madera contrachapada 3/4\" (4×8)", unit: "sheet", basePrice: 52, category: "lumber" as const },
  { id: "mat-10", item: "OSB 7/16\" (4×8 sheet)", itemEs: "OSB 7/16\" (4×8)", unit: "sheet", basePrice: 38, category: "lumber" as const },
  // Electrical
  { id: "mat-11", item: "Electrical Wire 12/2 Romex (250ft)", itemEs: "Cable eléctrico 12/2 Romex (250ft)", unit: "roll", basePrice: 145, category: "electrical" as const },
  { id: "mat-12", item: "Main Electrical Panel 200A", itemEs: "Panel eléctrico principal 200A", unit: "unit", basePrice: 380, category: "electrical" as const },
  { id: "mat-13", item: "LED Recessed Light 6\" (10-pack)", itemEs: "Luz empotrada LED 6\" (paquete de 10)", unit: "pack", basePrice: 89, category: "electrical" as const },
  { id: "mat-14", item: "GFCI Outlet (10-pack)", itemEs: "Tomacorriente GFCI (paquete de 10)", unit: "pack", basePrice: 65, category: "electrical" as const },
  // Plumbing
  { id: "mat-15", item: "PVC Pipe 3\" Schedule 40 (10ft)", itemEs: "Tubo PVC 3\" Schedule 40 (10ft)", unit: "each", basePrice: 22, category: "plumbing" as const },
  { id: "mat-16", item: "PEX Tubing 1/2\" (100ft)", itemEs: "Tubería PEX 1/2\" (100ft)", unit: "roll", basePrice: 42, category: "plumbing" as const },
  { id: "mat-17", item: "Water Heater — Tankless 199K BTU", itemEs: "Calentador de agua sin tanque 199K BTU", unit: "unit", basePrice: 1150, category: "plumbing" as const },
  // Finishes
  { id: "mat-18", item: "Porcelain Tile 24×24\" (per box)", itemEs: "Porcelanato 24×24\" (por caja)", unit: "box", basePrice: 68, category: "finishes" as const },
  { id: "mat-19", item: "Drywall 5/8\" Type X (4×8)", itemEs: "Drywall 5/8\" Tipo X (4×8)", unit: "sheet", basePrice: 18.5, category: "finishes" as const },
  { id: "mat-20", item: "Exterior Paint — Sherwin-Williams (1 gal)", itemEs: "Pintura exterior — Sherwin-Williams (1 gal)", unit: "gallon", basePrice: 58, category: "finishes" as const },
  { id: "mat-21", item: "Spray Foam Insulation (600 bd ft)", itemEs: "Espuma de poliuretano (600 bd ft)", unit: "kit", basePrice: 320, category: "insulation" as const },
  { id: "mat-22", item: "Standing Seam Metal Roof Panel (per sq)", itemEs: "Panel de techo metálico (por cuadro)", unit: "square", basePrice: 420, category: "finishes" as const },
  { id: "mat-23", item: "Aluminum Impact Window 3×5", itemEs: "Ventana de aluminio impacto 3×5", unit: "each", basePrice: 380, category: "finishes" as const },
  { id: "mat-24", item: "Steel Entry Door — Impact 3×7", itemEs: "Puerta de entrada de acero impacto 3×7", unit: "each", basePrice: 950, category: "finishes" as const },
];

export const CALCULATOR_ENTRIES = {
  "proj-1": [
    { id: "calc-1-1", projectId: "proj-1", materialId: "mat-1", materialName: "40ft Shipping Container (One-trip)", materialNameEs: "Contenedor 40ft (Un viaje)", category: "steel", unit: "unit", quantity: 2, basePrice: 6800, manualPriceOverride: null, effectivePrice: 6800, lineTotal: 13600 },
    { id: "calc-1-2", projectId: "proj-1", materialId: "mat-3", materialName: "Concrete — Ready Mix (3000 PSI)", materialNameEs: "Concreto — Mezcla lista (3000 PSI)", category: "foundation", unit: "yd³", quantity: 45, basePrice: 165, manualPriceOverride: 158, effectivePrice: 158, lineTotal: 7110 },
    { id: "calc-1-3", projectId: "proj-1", materialId: "mat-21", materialName: "Spray Foam Insulation (600 bd ft)", materialNameEs: "Espuma de poliuretano (600 bd ft)", category: "insulation", unit: "kit", quantity: 6, basePrice: 320, manualPriceOverride: null, effectivePrice: 320, lineTotal: 1920 },
    { id: "calc-1-4", projectId: "proj-1", materialId: "mat-22", materialName: "Standing Seam Metal Roof Panel (per sq)", materialNameEs: "Panel de techo metálico (por cuadro)", category: "finishes", unit: "square", quantity: 18, basePrice: 420, manualPriceOverride: null, effectivePrice: 420, lineTotal: 7560 },
  ],
  "proj-2": [
    { id: "calc-2-1", projectId: "proj-2", materialId: "mat-1", materialName: "40ft Shipping Container (One-trip)", materialNameEs: "Contenedor 40ft (Un viaje)", category: "steel", unit: "unit", quantity: 3, basePrice: 6800, manualPriceOverride: 6500, effectivePrice: 6500, lineTotal: 19500 },
    { id: "calc-2-2", projectId: "proj-2", materialId: "mat-3", materialName: "Concrete — Ready Mix (3000 PSI)", materialNameEs: "Concreto — Mezcla lista (3000 PSI)", category: "foundation", unit: "yd³", quantity: 120, basePrice: 165, manualPriceOverride: null, effectivePrice: 165, lineTotal: 19800 },
    { id: "calc-2-3", projectId: "proj-2", materialId: "mat-11", materialName: "Electrical Wire 12/2 Romex (250ft)", materialNameEs: "Cable eléctrico 12/2 Romex (250ft)", category: "electrical", unit: "roll", quantity: 24, basePrice: 145, manualPriceOverride: null, effectivePrice: 145, lineTotal: 3480 },
    { id: "calc-2-4", projectId: "proj-2", materialId: "mat-18", materialName: "Porcelain Tile 24×24\" (per box)", materialNameEs: "Porcelanato 24×24\" (por caja)", category: "finishes", unit: "box", quantity: 85, basePrice: 68, manualPriceOverride: 72, effectivePrice: 72, lineTotal: 6120 },
    { id: "calc-2-5", projectId: "proj-2", materialId: "mat-19", materialName: "Drywall 5/8\" Type X (4×8)", materialNameEs: "Drywall 5/8\" Tipo X (4×8)", category: "finishes", unit: "sheet", quantity: 340, basePrice: 18.5, manualPriceOverride: null, effectivePrice: 18.5, lineTotal: 6290 },
    { id: "calc-2-6", projectId: "proj-2", materialId: "mat-23", materialName: "Aluminum Impact Window 3×5", materialNameEs: "Ventana de aluminio impacto 3×5", category: "finishes", unit: "each", quantity: 18, basePrice: 380, manualPriceOverride: 365, effectivePrice: 365, lineTotal: 6570 },
    { id: "calc-2-7", projectId: "proj-2", materialId: "mat-17", materialName: "Water Heater — Tankless 199K BTU", materialNameEs: "Calentador de agua sin tanque 199K BTU", category: "plumbing", unit: "unit", quantity: 2, basePrice: 1150, manualPriceOverride: null, effectivePrice: 1150, lineTotal: 2300 },
    { id: "calc-2-8", projectId: "proj-2", materialId: "mat-21", materialName: "Spray Foam Insulation (600 bd ft)", materialNameEs: "Espuma de poliuretano (600 bd ft)", category: "insulation", unit: "kit", quantity: 14, basePrice: 320, manualPriceOverride: null, effectivePrice: 320, lineTotal: 4480 },
  ],
  "proj-3": [
    { id: "calc-3-1", projectId: "proj-3", materialId: "mat-2", materialName: "20ft Shipping Container (One-trip)", materialNameEs: "Contenedor 20ft (Un viaje)", category: "steel", unit: "unit", quantity: 2, basePrice: 3900, manualPriceOverride: null, effectivePrice: 3900, lineTotal: 7800 },
    { id: "calc-3-2", projectId: "proj-3", materialId: "mat-3", materialName: "Concrete — Ready Mix (3000 PSI)", materialNameEs: "Concreto — Mezcla lista (3000 PSI)", category: "foundation", unit: "yd³", quantity: 38, basePrice: 165, manualPriceOverride: 162, effectivePrice: 162, lineTotal: 6156 },
    { id: "calc-3-3", projectId: "proj-3", materialId: "mat-20", materialName: "Exterior Paint — Sherwin-Williams (1 gal)", materialNameEs: "Pintura exterior — Sherwin-Williams (1 gal)", category: "finishes", unit: "gallon", quantity: 42, basePrice: 58, manualPriceOverride: null, effectivePrice: 58, lineTotal: 2436 },
    { id: "calc-3-4", projectId: "proj-3", materialId: "mat-13", materialName: "LED Recessed Light 6\" (10-pack)", materialNameEs: "Luz empotrada LED 6\" (paquete de 10)", category: "electrical", unit: "pack", quantity: 8, basePrice: 89, manualPriceOverride: null, effectivePrice: 89, lineTotal: 712 },
  ],
};

export const RECENT_ACTIVITY = [
  {
    id: "act-1",
    type: "document_upload" as const,
    projectId: "proj-2",
    projectName: "Residencia Martínez Ocasio",
    description: "Miranda Klopf uploaded 'Weekly Progress Report — Week 32' to Client Review",
    descriptionEs: "Miranda Klopf subió 'Reporte Semanal de Progreso — Semana 32' a Revisión del Cliente",
    actor: "Miranda Klopf",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "act-2",
    type: "task_completed" as const,
    projectId: "proj-2",
    projectName: "Residencia Martínez Ocasio",
    description: "Jorge Rosa completed 'Order roofing materials — Lot B'",
    descriptionEs: "Jorge Rosa completó 'Ordenar materiales de techo — Lote B'",
    actor: "Jorge Rosa",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "act-3",
    type: "task_completed" as const,
    projectId: "proj-2",
    projectName: "Residencia Martínez Ocasio",
    description: "Andrea Camacho completed 'Framing inspection — Container 2'",
    descriptionEs: "Andrea Camacho completó 'Inspección de estructura — Contenedor 2'",
    actor: "Andrea Camacho",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "act-4",
    type: "document_upload" as const,
    projectId: "proj-1",
    projectName: "Casa Solar Rincón",
    description: "Andrea Camacho uploaded 'Zoning Analysis — Rincón Municipality' to Permits",
    descriptionEs: "Andrea Camacho subió 'Análisis de Zonificación — Rincón' a Permisos",
    actor: "Andrea Camacho",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "act-5",
    type: "phase_change" as const,
    projectId: "proj-2",
    projectName: "Residencia Martínez Ocasio",
    description: "Project advanced to Phase 5 — Construction",
    descriptionEs: "Proyecto avanzó a Fase 5 — Construcción",
    actor: "Carla Gautier",
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "act-6",
    type: "weather_alert" as const,
    projectId: "proj-2",
    projectName: "Residencia Martínez Ocasio",
    description: "Weather Alert: Afternoon showers expected in Vega Alta — delay outdoor concrete work",
    descriptionEs: "Alerta Climática: Chubascos esperados en Vega Alta — posponer trabajo de concreto exterior",
    actor: "System",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

// ============================================================
// Phase 1 — Lead Intake & Discovery
// ============================================================

export type LeadProjectType = "residencial" | "comercial" | "mixto" | "contenedor";
export type LeadTerrain = "no_terrain" | "with_terrain" | "with_plans";
export type LeadSource = "website" | "social" | "referral" | "media" | "events";
export type LeadBudget = "under_150k" | "150k_300k" | "300k_500k" | "500k_1m" | "over_1m";
export type LeadStatus = "new" | "contacted" | "accepted" | "rejected";
export type BookingType = "consultation_30min" | "weekly_seminar";

export interface LeadBooking {
  type: BookingType;
  slot: string; // ISO datetime
  label: string;
}

export interface Lead {
  id: string;
  source: LeadSource;
  projectType: LeadProjectType;
  location: string;
  budgetRange: LeadBudget;
  terrainStatus: LeadTerrain;
  contactName: string;
  email: string;
  phone: string;
  notes?: string;
  createdAt: string;
  score: number;
  status: LeadStatus;
  booking?: LeadBooking;
  asanaGid?: string;
}

export function computeLeadScore(input: {
  projectType: LeadProjectType;
  budgetRange: LeadBudget;
  location: string;
  terrainStatus: LeadTerrain;
}): number {
  // Project type weighting (containers are KONTi's specialty)
  const typeScore: Record<LeadProjectType, number> = {
    contenedor: 35,
    mixto: 28,
    residencial: 24,
    comercial: 22,
  };
  // Budget weighting
  const budgetScore: Record<LeadBudget, number> = {
    under_150k: 8,
    "150k_300k": 18,
    "300k_500k": 26,
    "500k_1m": 32,
    over_1m: 35,
  };
  // Terrain readiness
  const terrainScore: Record<LeadTerrain, number> = {
    no_terrain: 6,
    with_terrain: 14,
    with_plans: 18,
  };
  // Location bonus — PR coastal/metro favored
  const loc = input.location.toLowerCase();
  let locationScore = 4;
  if (/(rinc[oó]n|isabela|aguadilla|cabo rojo|fajardo|culebra|vieques|loiza|loíza|dorado)/.test(loc)) {
    locationScore = 12;
  } else if (/(san juan|santurce|condado|miramar|guaynabo|bayam[oó]n|carolina|caguas|ponce|mayag[uü]ez)/.test(loc)) {
    locationScore = 10;
  } else if (/puerto rico|pr\b/.test(loc)) {
    locationScore = 7;
  }

  const total =
    typeScore[input.projectType] +
    budgetScore[input.budgetRange] +
    terrainScore[input.terrainStatus] +
    locationScore;

  return Math.min(100, Math.max(0, Math.round(total)));
}

const seedLeadInputs: Array<Omit<Lead, "score" | "createdAt"> & { hoursAgo: number }> = [
  {
    id: "lead-1",
    source: "referral",
    projectType: "contenedor",
    location: "Isabela, Puerto Rico",
    budgetRange: "500k_1m",
    terrainStatus: "with_plans",
    contactName: "María Rivera Quiñones",
    email: "maria.rivera@example.com",
    phone: "+1 787-555-0142",
    notes: "Referida por cliente de Casa Solar Rincón. Busca casa de playa modular.",
    status: "new",
    hoursAgo: 4,
  },
  {
    id: "lead-2",
    source: "website",
    projectType: "residencial",
    location: "Caguas, Puerto Rico",
    budgetRange: "300k_500k",
    terrainStatus: "with_terrain",
    contactName: "Luis Hernández",
    email: "lhernandez@example.com",
    phone: "+1 787-555-0188",
    notes: "Familia de 5 — busca diseño bioclimático.",
    status: "new",
    hoursAgo: 22,
  },
  {
    id: "lead-3",
    source: "social",
    projectType: "comercial",
    location: "Santurce, San Juan, PR",
    budgetRange: "150k_300k",
    terrainStatus: "with_terrain",
    contactName: "Sofia Marrero",
    email: "sofia@cafemarrero.pr",
    phone: "+1 787-555-0123",
    notes: "Quiere abrir café-galería en Santurce.",
    status: "contacted",
    booking: {
      type: "consultation_30min",
      slot: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      label: "1:1 — 30min",
    },
    hoursAgo: 50,
  },
  {
    id: "lead-4",
    source: "events",
    projectType: "mixto",
    location: "Dorado, Puerto Rico",
    budgetRange: "over_1m",
    terrainStatus: "with_plans",
    contactName: "Roberto Vega Cintrón",
    email: "rvega@vegaholdings.com",
    phone: "+1 787-555-0211",
    notes: "Conoció a Carla en Foro Caribe Sostenible 2026.",
    status: "new",
    booking: {
      type: "weekly_seminar",
      slot: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      label: "Seminario semanal Sat 10am",
    },
    hoursAgo: 8,
  },
  {
    id: "lead-5",
    source: "media",
    projectType: "residencial",
    location: "Mayagüez, PR",
    budgetRange: "under_150k",
    terrainStatus: "no_terrain",
    contactName: "Pedro Colón",
    email: "pcolon@example.com",
    phone: "+1 787-555-0177",
    notes: "Vio entrevista en El Nuevo Día.",
    status: "new",
    hoursAgo: 75,
  },
  {
    id: "lead-6",
    source: "referral",
    projectType: "contenedor",
    location: "Fajardo, Puerto Rico",
    budgetRange: "300k_500k",
    terrainStatus: "with_terrain",
    contactName: "Ana Beatriz Soto",
    email: "absoto@example.com",
    phone: "+1 787-555-0190",
    notes: "Eco-resort de 4 unidades.",
    status: "new",
    hoursAgo: 12,
  },
];

export const LEADS: Lead[] = seedLeadInputs.map((l) => {
  const { hoursAgo, ...rest } = l;
  return {
    ...rest,
    createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
    score: computeLeadScore({
      projectType: rest.projectType,
      budgetRange: rest.budgetRange,
      location: rest.location,
      terrainStatus: rest.terrainStatus,
    }),
  };
});

// ---------------------------------------------------------------------------
// Phase 2 — Pre-Design & Viability Study additions
// ---------------------------------------------------------------------------

export type ChecklistStatus = "pending" | "in_progress" | "done";

export interface PreDesignChecklistItem {
  id: string;
  label: string;
  labelEs: string;
  status: ChecklistStatus;
  assignee: string;
  completedAt?: string;
}

export interface ProjectActivity {
  id: string;
  timestamp: string;
  type: "phase_change" | "checklist_toggle" | "gamma_generated" | "email_sent" | "invoice_sent" | "weekly_report" | "structured_variables" | "proposal_decision" | "change_order_created" | "change_order_decision" | "sub_phase_advanced" | "permit_authorization" | "permit_signature" | "permit_submitted" | "permit_state_change";
  actor: string;
  description: string;
  descriptionEs: string;
}

export interface StructuredVariables {
  squareMeters: number;
  zoningCode: string;
  projectType: "residencial" | "comercial" | "mixto" | "contenedor";
  submittedAt: string;
  submittedBy: string;
}

export interface AssistedBudgetRange {
  low: number;
  mid: number;
  high: number;
  currency: "USD";
  perSqMeterMid: number;
}

export interface WeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  title: string;
  titleEs: string;
  url: string;
}

const defaultChecklist = (): PreDesignChecklistItem[] => [
  { id: "ck-1", label: "Site coordination meeting", labelEs: "Reunión de coordinación en sitio", status: "done", assignee: "Carla Gautier", completedAt: "2026-04-02T10:00:00Z" },
  { id: "ck-2", label: "Site survey", labelEs: "Levantamiento del sitio", status: "done", assignee: "Jorge Rosa", completedAt: "2026-04-05T13:30:00Z" },
  { id: "ck-3", label: "Measurements & dimensions", labelEs: "Medidas y dimensiones", status: "in_progress", assignee: "Jorge Rosa" },
  { id: "ck-4", label: "360° photographs", labelEs: "Fotografías 360°", status: "in_progress", assignee: "Miranda Klopf" },
  { id: "ck-5", label: "Terrain conditions assessment", labelEs: "Evaluación de condiciones del terreno", status: "pending", assignee: "Andrea Camacho" },
  { id: "ck-6", label: "Three layout options", labelEs: "Tres opciones de layout", status: "pending", assignee: "Michelle Telon Sosa" },
  { id: "ck-7", label: "Three budget scenarios", labelEs: "Tres escenarios de presupuesto", status: "pending", assignee: "Carla Gautier" },
  { id: "ck-8", label: "Prefeasibility / zoning analysis", labelEs: "Prefactibilidad y análisis de zonificación", status: "pending", assignee: "Andrea Camacho" },
  { id: "ck-9", label: "Architecture, engineering & permits proposal", labelEs: "Propuesta de arquitectura, ingeniería y permisos", status: "pending", assignee: "Carla Gautier" },
  { id: "ck-10", label: "Pre-Design & Viability Study invoice", labelEs: "Factura del estudio de prefactibilidad", status: "pending", assignee: "Carla Gautier" },
];

export const PRE_DESIGN_CHECKLISTS: Record<string, PreDesignChecklistItem[]> = {
  "proj-1": defaultChecklist(),
  "proj-2": defaultChecklist().map((c) => ({ ...c, status: "done" as const, completedAt: "2025-09-15T12:00:00Z" })),
  "proj-3": defaultChecklist().map((c) => ({ ...c, status: "done" as const, completedAt: "2025-02-01T12:00:00Z" })),
};

export const PROJECT_ACTIVITIES: Record<string, ProjectActivity[]> = {
  "proj-1": [
    { id: "act-1-1", timestamp: "2026-04-02T10:00:00Z", type: "phase_change", actor: "System", description: "Project created from accepted lead", descriptionEs: "Proyecto creado desde lead aceptado" },
    { id: "act-1-2", timestamp: "2026-04-02T10:05:00Z", type: "email_sent", actor: "System", description: "Welcome email sent to client", descriptionEs: "Correo de bienvenida enviado al cliente" },
    { id: "act-1-3", timestamp: "2026-04-02T11:00:00Z", type: "checklist_toggle", actor: "Carla Gautier", description: "Site coordination meeting completed", descriptionEs: "Reunión de coordinación en sitio completada" },
    { id: "act-1-4", timestamp: "2026-04-05T14:00:00Z", type: "checklist_toggle", actor: "Jorge Rosa", description: "Site survey completed", descriptionEs: "Levantamiento del sitio completado" },
    { id: "act-1-5", timestamp: "2026-04-10T09:00:00Z", type: "weekly_report", actor: "GAMMA", description: "Week-of Apr 6 progress report generated", descriptionEs: "Reporte semanal del 6 de abril generado" },
    { id: "act-1-6", timestamp: "2026-04-17T09:00:00Z", type: "weekly_report", actor: "GAMMA", description: "Week-of Apr 13 progress report generated", descriptionEs: "Reporte semanal del 13 de abril generado" },
  ],
  "proj-2": [
    { id: "act-2-1", timestamp: "2025-08-01T10:00:00Z", type: "phase_change", actor: "System", description: "Project advanced to Construction", descriptionEs: "Proyecto avanzado a Construcción" },
    { id: "act-2-2", timestamp: "2026-04-14T16:00:00Z", type: "weekly_report", actor: "Miranda Klopf", description: "Weekly construction report sent to client", descriptionEs: "Reporte semanal de construcción enviado al cliente" },
  ],
  "proj-3": [
    { id: "act-3-1", timestamp: "2025-11-30T16:00:00Z", type: "phase_change", actor: "Carla Gautier", description: "Project marked as completed", descriptionEs: "Proyecto marcado como completado" },
  ],
};

export const PROJECT_STRUCTURED_VARS: Record<string, StructuredVariables | undefined> = {
  "proj-1": undefined,
  "proj-2": { squareMeters: 320, zoningCode: "R-3", projectType: "residencial", submittedAt: "2025-08-05T09:00:00Z", submittedBy: "Carla Gautier" },
  "proj-3": { squareMeters: 95, zoningCode: "C-2", projectType: "comercial", submittedAt: "2025-01-20T11:00:00Z", submittedBy: "Carla Gautier" },
};

const PER_M2_BY_TYPE: Record<string, number> = {
  residencial: 1850,
  comercial: 2100,
  mixto: 2300,
  contenedor: 1500,
};

export function computeAssistedBudget(vars: StructuredVariables): AssistedBudgetRange {
  const perM2 = PER_M2_BY_TYPE[vars.projectType] ?? 1800;
  const mid = Math.round(vars.squareMeters * perM2);
  return {
    low: Math.round(mid * 0.85),
    mid,
    high: Math.round(mid * 1.2),
    currency: "USD",
    perSqMeterMid: perM2,
  };
}

export const PROJECT_ASSISTED_BUDGETS: Record<string, AssistedBudgetRange | undefined> = {
  "proj-1": undefined,
  "proj-2": PROJECT_STRUCTURED_VARS["proj-2"] ? computeAssistedBudget(PROJECT_STRUCTURED_VARS["proj-2"]!) : undefined,
  "proj-3": PROJECT_STRUCTURED_VARS["proj-3"] ? computeAssistedBudget(PROJECT_STRUCTURED_VARS["proj-3"]!) : undefined,
};

const weekly = (id: string, weekStart: string, weekEnd: string, title: string, titleEs: string, url: string): WeeklyReport => ({ id, weekStart, weekEnd, title, titleEs, url });

export const WEEKLY_REPORTS: Record<string, WeeklyReport[]> = {
  "proj-1": [
    weekly("wr-1-1", "2026-03-30", "2026-04-05", "Site coordination & initial survey", "Coordinación del sitio y levantamiento inicial", "/projects/proj-1/report"),
    weekly("wr-1-2", "2026-04-06", "2026-04-12", "Topographic data collection", "Recolección de datos topográficos", "/projects/proj-1/report"),
    weekly("wr-1-3", "2026-04-13", "2026-04-19", "Zoning consultation with municipality", "Consulta de zonificación con el municipio", "/projects/proj-1/report"),
    weekly("wr-1-4", "2026-04-20", "2026-04-26", "Layout option drafts in progress", "Borradores de opciones de layout en progreso", "/projects/proj-1/report"),
  ],
  "proj-2": [
    weekly("wr-2-1", "2026-04-06", "2026-04-12", "Roofing installation - Container 2", "Instalación de techo — Contenedor 2", "/projects/proj-2/report"),
    weekly("wr-2-2", "2026-04-13", "2026-04-19", "Bathroom tiling and electrical rough-in", "Azulejos del baño e instalación eléctrica preliminar", "/projects/proj-2/report"),
  ],
  "proj-3": [
    weekly("wr-3-1", "2025-11-17", "2025-11-23", "Final walkthrough & punch list", "Recorrido final y punch list", "/projects/proj-3/report"),
    weekly("wr-3-2", "2025-11-24", "2025-11-30", "Project closeout & certificate of occupancy", "Cierre de proyecto y certificado de ocupación", "/projects/proj-3/report"),
  ],
};

export function appendActivity(projectId: string, activity: Omit<ProjectActivity, "id" | "timestamp">): ProjectActivity {
  const list = PROJECT_ACTIVITIES[projectId] ?? (PROJECT_ACTIVITIES[projectId] = []);
  const entry: ProjectActivity = {
    id: `act-${projectId}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...activity,
  };
  list.unshift(entry);
  return entry;
}

export type ProjectPhase =
  | "discovery"
  | "consultation"
  | "pre_design"
  | "schematic_design"
  | "design_development"
  | "construction_documents"
  | "permits"
  | "construction"
  | "completed";

export const PHASE_ORDER: ProjectPhase[] = [
  "discovery",
  "consultation",
  "pre_design",
  "schematic_design",
  "design_development",
  "construction_documents",
  "permits",
  "construction",
  "completed",
];

export const PHASE_LABELS_MAP: Record<ProjectPhase, { en: string; es: string }> = {
  discovery: { en: "Discovery", es: "Descubrimiento" },
  consultation: { en: "Consultation", es: "Consulta Inicial" },
  pre_design: { en: "Pre-Design & Viability", es: "Pre-Diseño y Viabilidad" },
  schematic_design: { en: "Schematic Design", es: "Diseño Esquemático" },
  design_development: { en: "Design Development", es: "Desarrollo de Diseño" },
  construction_documents: { en: "Construction Documents", es: "Documentos de Construcción" },
  permits: { en: "Permits", es: "Permisos" },
  construction: { en: "Construction", es: "Construcción" },
  completed: { en: "Completed", es: "Completado" },
};

// ---------------------------------------------------------------------------
// Phase 3 — Design sub-phases, Proposals & Change Orders
// ---------------------------------------------------------------------------

export type DesignSubPhase = "schematic_design" | "design_development" | "construction_documents";
export const DESIGN_SUB_PHASE_ORDER: DesignSubPhase[] = ["schematic_design", "design_development", "construction_documents"];

export const DESIGN_SUB_PHASE_LABELS: Record<DesignSubPhase, { en: string; es: string }> = {
  schematic_design: { en: "Schematic Design", es: "Diseño Esquemático" },
  design_development: { en: "Design Development", es: "Desarrollo de Diseño" },
  construction_documents: { en: "Construction Documents", es: "Documentos de Construcción" },
};

export type DesignDeliverableStatus = "pending" | "in_progress" | "done";

export interface DesignDeliverable {
  id: string;
  label: string;
  labelEs: string;
  owner: string;
  status: DesignDeliverableStatus;
  completedAt?: string;
}

export interface DesignSubPhaseState {
  startedAt?: string;
  completedAt?: string;
  deliverables: DesignDeliverable[];
}

export interface ProjectDesignState {
  projectId: string;
  currentSubPhase: DesignSubPhase | "complete";
  subPhases: Record<DesignSubPhase, DesignSubPhaseState>;
}

const buildDeliverables = (sub: DesignSubPhase, status: DesignDeliverableStatus): DesignDeliverable[] => {
  const sets: Record<DesignSubPhase, Array<[string, string, string]>> = {
    schematic_design: [
      ["Concept floor plans", "Plantas conceptuales", "Michelle Telon Sosa"],
      ["Massing & site studies", "Estudios de masas y sitio", "Michelle Telon Sosa"],
      ["Bioclimatic strategy memo", "Memoria de estrategia bioclimática", "Carla Gautier"],
      ["Sustainability targets review", "Revisión de metas de sostenibilidad", "Carla Gautier"],
    ],
    design_development: [
      ["Refined floor plans & elevations", "Plantas y elevaciones refinadas", "Michelle Telon Sosa"],
      ["Structural coordination set", "Conjunto de coordinación estructural", "Jorge Rosa"],
      ["MEP narrative", "Narrativa MEP", "Jorge Rosa"],
      ["Material & finish schedule", "Cronograma de materiales y acabados", "Miranda Klopf"],
      ["Cost estimate update", "Actualización de estimado de costos", "Carla Gautier"],
    ],
    construction_documents: [
      ["Stamped architectural set", "Set arquitectónico sellado", "Carla Gautier"],
      ["Structural & engineering CDs", "CDs estructurales y de ingeniería", "Jorge Rosa"],
      ["Specifications book", "Libro de especificaciones", "Andrea Camacho"],
      ["Bid package & GC pricing", "Paquete de licitación y costeo del GC", "Carla Gautier"],
    ],
  };
  return sets[sub].map(([en, es, owner], i) => ({
    id: `${sub}-d${i + 1}`,
    label: en,
    labelEs: es,
    owner,
    status,
    completedAt: status === "done" ? "2025-09-01T12:00:00Z" : undefined,
  }));
};

const designStateNotStarted = (projectId: string): ProjectDesignState => ({
  projectId,
  currentSubPhase: "schematic_design",
  subPhases: {
    schematic_design: { deliverables: buildDeliverables("schematic_design", "pending") },
    design_development: { deliverables: buildDeliverables("design_development", "pending") },
    construction_documents: { deliverables: buildDeliverables("construction_documents", "pending") },
  },
});

const designStateComplete = (projectId: string, completedAt: string): ProjectDesignState => ({
  projectId,
  currentSubPhase: "complete",
  subPhases: {
    schematic_design: { startedAt: completedAt, completedAt, deliverables: buildDeliverables("schematic_design", "done") },
    design_development: { startedAt: completedAt, completedAt, deliverables: buildDeliverables("design_development", "done") },
    construction_documents: { startedAt: completedAt, completedAt, deliverables: buildDeliverables("construction_documents", "done") },
  },
});

export const PROJECT_DESIGN_STATE: Record<string, ProjectDesignState> = {
  "proj-1": designStateNotStarted("proj-1"),
  "proj-2": designStateComplete("proj-2", "2025-09-30T17:00:00Z"),
  "proj-3": designStateComplete("proj-3", "2025-04-30T17:00:00Z"),
};

// --- Proposals (3 budget scenarios coming out of Pre-Design) ----------------

export type ProposalScenario = "economy" | "standard" | "premium";
export type ProposalStatus = "pending" | "approved" | "rejected";

export interface Proposal {
  id: string;
  projectId: string;
  scenario: ProposalScenario;
  title: string;
  titleEs: string;
  summary: string;
  summaryEs: string;
  totalCost: number;
  durationWeeks: number;
  highlights: string[];
  highlightsEs: string[];
  status: ProposalStatus;
  decidedAt?: string;
  decidedBy?: string;
}

const proj1Proposals: Proposal[] = [
  {
    id: "prop-1-economy", projectId: "proj-1", scenario: "economy",
    title: "Economy — Single container core",
    titleEs: "Económica — Núcleo de un contenedor",
    summary: "One 40ft container, off-grid solar starter kit, prefab finishes.",
    summaryEs: "Un contenedor de 40ft, kit solar inicial fuera de red, acabados prefabricados.",
    totalCost: 185000, durationWeeks: 22,
    highlights: ["1 × 40ft container", "3 kW solar starter", "Standard impact windows", "Concrete pier foundation"],
    highlightsEs: ["1 contenedor 40ft", "Solar 3 kW inicial", "Ventanas de impacto estándar", "Cimentación de pilotes"],
    status: "pending",
  },
  {
    id: "prop-1-standard", projectId: "proj-1", scenario: "standard",
    title: "Standard — Coastal eco-home",
    titleEs: "Estándar — Eco-casa costera",
    summary: "Two 40ft containers, full solar + battery, custom millwork.",
    summaryEs: "Dos contenedores de 40ft, solar completo con batería, ebanistería a medida.",
    totalCost: 245000, durationWeeks: 28,
    highlights: ["2 × 40ft containers", "8 kW solar + 13 kWh battery", "Whole-house impact glazing", "Cistern + greywater reuse"],
    highlightsEs: ["2 contenedores 40ft", "Solar 8 kW + batería 13 kWh", "Vidrio de impacto en toda la casa", "Cisterna y reúso de aguas grises"],
    status: "pending",
  },
  {
    id: "prop-1-premium", projectId: "proj-1", scenario: "premium",
    title: "Premium — Luxury beach retreat",
    titleEs: "Premium — Retiro de playa de lujo",
    summary: "Three containers with lap pool, premium finishes, smart-home stack.",
    summaryEs: "Tres contenedores con piscina lap, acabados premium, paquete domótico.",
    totalCost: 325000, durationWeeks: 34,
    highlights: ["3 × containers + steel canopy", "12 kW solar + 26 kWh battery", "Lap pool & outdoor kitchen", "Full smart-home automation"],
    highlightsEs: ["3 contenedores + canopy de acero", "Solar 12 kW + batería 26 kWh", "Piscina lap y cocina exterior", "Automatización domótica completa"],
    status: "pending",
  },
];

export const PROJECT_PROPOSALS: Record<string, Proposal[]> = {
  "proj-1": proj1Proposals,
  "proj-2": [
    {
      id: "prop-2-standard", projectId: "proj-2", scenario: "standard",
      title: "Standard — Family residence (approved)",
      titleEs: "Estándar — Residencia familiar (aprobada)",
      summary: "Three-container family home with full solar package.",
      summaryEs: "Casa familiar de tres contenedores con paquete solar completo.",
      totalCost: 320000, durationWeeks: 30,
      highlights: ["3 × 40ft containers", "10 kW solar + battery", "Premium impact glazing"],
      highlightsEs: ["3 contenedores 40ft", "Solar 10 kW + batería", "Vidrio de impacto premium"],
      status: "approved",
      decidedAt: "2025-08-01T15:00:00Z", decidedBy: "Andrés Martínez",
    },
  ],
  "proj-3": [],
};

// --- Change Orders ----------------------------------------------------------

export type ChangeOrderStatus = "pending" | "approved" | "rejected";

export interface ChangeOrder {
  id: string;
  projectId: string;
  number: string; // CO-001, CO-002…
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  amountDelta: number; // signed USD
  scheduleImpactDays: number;
  reason: string;
  reasonEs: string;
  requestedBy: string;
  requestedAt: string;
  status: ChangeOrderStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  outsideOfScope: boolean;
}

export const PROJECT_CHANGE_ORDERS: Record<string, ChangeOrder[]> = {
  "proj-1": [],
  "proj-2": [
    {
      id: "co-2-1", projectId: "proj-2", number: "CO-001",
      title: "Upgrade to standing-seam metal roof",
      titleEs: "Cambio a techo metálico de costura alzada",
      description: "Owner-requested upgrade from asphalt shingles to standing-seam metal roof on both containers.",
      descriptionEs: "Cambio solicitado por el propietario de tejas asfálticas a techo metálico de costura alzada en ambos contenedores.",
      amountDelta: 8400, scheduleImpactDays: 5,
      reason: "Hurricane resilience and lifetime warranty.",
      reasonEs: "Resiliencia ante huracanes y garantía de por vida.",
      requestedBy: "Carla Gautier",
      requestedAt: "2026-02-12T15:00:00Z",
      status: "approved",
      decidedBy: "Andrés Martínez", decidedAt: "2026-02-14T11:00:00Z",
      decisionNote: "Approved — owner accepts schedule slip.",
      outsideOfScope: false,
    },
    {
      id: "co-2-2", projectId: "proj-2", number: "CO-002",
      title: "Extra outdoor concrete patio",
      titleEs: "Patio de concreto exterior adicional",
      description: "Add 320 sq ft poured concrete patio off the master suite.",
      descriptionEs: "Agregar 320 pies² de patio de concreto vertido junto a la suite principal.",
      amountDelta: 3850, scheduleImpactDays: 3,
      reason: "Owner change after framing review.",
      reasonEs: "Cambio del propietario tras revisión de estructura.",
      requestedBy: "Jorge Rosa",
      requestedAt: "2026-04-15T14:30:00Z",
      status: "pending",
      outsideOfScope: true,
    },
  ],
  "proj-3": [
    {
      id: "co-3-1", projectId: "proj-3", number: "CO-001",
      title: "Bar millwork upgrade",
      titleEs: "Mejora de ebanistería del bar",
      description: "Upgrade bar countertop to live-edge mango wood with steel base.",
      descriptionEs: "Mejora del mostrador del bar a madera de mango con base de acero.",
      amountDelta: 2100, scheduleImpactDays: 0,
      reason: "Brand-fit per Sofia Marrero.",
      reasonEs: "Ajuste de marca según Sofia Marrero.",
      requestedBy: "Michelle Telon Sosa",
      requestedAt: "2025-09-10T10:00:00Z",
      status: "approved",
      decidedBy: "Sofia Marrero", decidedAt: "2025-09-12T09:00:00Z",
      outsideOfScope: true,
    },
  ],
};

let changeOrderSeq = 100;
export function nextChangeOrderNumber(projectId: string): string {
  const list = PROJECT_CHANGE_ORDERS[projectId] ?? (PROJECT_CHANGE_ORDERS[projectId] = []);
  const n = list.length + 1 + (changeOrderSeq++ % 1); // simple count
  return `CO-${String(n).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Phase 4 — Permits Authorization Workflow
// ---------------------------------------------------------------------------

export type PermitAuthorizationStatus = "none" | "authorized";

export interface PermitAuthorization {
  status: PermitAuthorizationStatus;
  authorizedBy?: string;
  authorizedAt?: string;
  authorizedIpMock?: string;
  summaryAccepted: boolean;
}

export interface RequiredSignature {
  id: string;
  formName: string;
  formNameEs: string;
  required: boolean;
  signedBy?: string;
  signedAt?: string;
}

export type PermitItemState = "not_submitted" | "submitted" | "in_review" | "revision_requested" | "approved";

export const PERMIT_ITEM_STATE_ORDER: PermitItemState[] = [
  "not_submitted",
  "submitted",
  "in_review",
  "revision_requested",
  "approved",
];

export interface PermitItem {
  id: string;
  name: string;
  nameEs: string;
  agency: string;
  responsible: string;
  state: PermitItemState;
  lastUpdatedAt?: string;
  revisionNote?: string;
  revisionNoteEs?: string;
  estimatedTime: string;
  estimatedTimeEs: string;
  notes: string;
  notesEs: string;
}

const standardSignatures = (): RequiredSignature[] => [
  { id: "sig-owner-affidavit", formName: "Owner's Affidavit", formNameEs: "Affidavit del Dueño", required: true },
  { id: "sig-pe-authorization", formName: "PE Stamp Authorization", formNameEs: "Autorización Sello PE", required: true },
  { id: "sig-arpe-application", formName: "ARPE Use Permit Application", formNameEs: "Solicitud Permiso de Uso ARPE", required: true },
  { id: "sig-ogpe-cover", formName: "OGPE Submission Cover Letter", formNameEs: "Carta de Sometimiento OGPE", required: true },
];

const permitItemsTemplate = (defaults: { state: PermitItemState; lastUpdatedAt?: string }): PermitItem[] => [
  { id: "perm-pe-stamp", name: "Structural Engineering Stamp", nameEs: "Sello de Ingeniería Estructural", agency: "CIAPR", responsible: "Andrea Camacho", state: defaults.state, lastUpdatedAt: defaults.lastUpdatedAt, estimatedTime: "2–4 weeks", estimatedTimeEs: "2–4 semanas", notes: "Licensed PE stamp on structural drawings.", notesEs: "Sello PE licenciado en planos estructurales." },
  { id: "perm-arpe-use", name: "ARPE Use Permit (Uso Conforme)", nameEs: "Permiso de Uso ARPE (Uso Conforme)", agency: "ARPE", responsible: "Andrea Camacho", state: defaults.state, lastUpdatedAt: defaults.lastUpdatedAt, estimatedTime: "4–8 weeks", estimatedTimeEs: "4–8 semanas", notes: "Land use conformity by ARPE.", notesEs: "Conformidad de uso de suelo por ARPE." },
  { id: "perm-building", name: "Building Permit (Permiso de Construcción)", nameEs: "Permiso de Construcción", agency: "OGPE / Municipio", responsible: "Andrea Camacho", state: defaults.state, lastUpdatedAt: defaults.lastUpdatedAt, estimatedTime: "6–12 weeks", estimatedTimeEs: "6–12 semanas", notes: "Main construction permit issued by OGPE.", notesEs: "Permiso principal de construcción emitido por OGPE." },
  { id: "perm-electrical", name: "Electrical Inspection Permit", nameEs: "Permiso de Inspección Eléctrica", agency: "AELEC / LUMA", responsible: "Jorge Rosa", state: defaults.state, lastUpdatedAt: defaults.lastUpdatedAt, estimatedTime: "1–3 weeks", estimatedTimeEs: "1–3 semanas", notes: "Electrical system inspection.", notesEs: "Inspección del sistema eléctrico." },
  { id: "perm-plumbing", name: "Plumbing Inspection Permit", nameEs: "Permiso de Inspección de Plomería", agency: "Junta de Calidad Ambiental", responsible: "Jorge Rosa", state: defaults.state, lastUpdatedAt: defaults.lastUpdatedAt, estimatedTime: "1–2 weeks", estimatedTimeEs: "1–2 semanas", notes: "Potable water and sewage approvals.", notesEs: "Aprobaciones de agua potable y alcantarillado." },
  { id: "perm-fire", name: "Fire & Safety Certificate", nameEs: "Certificado de Bomberos", agency: "Cuerpo de Bomberos PR", responsible: "Jorge Rosa", state: defaults.state, lastUpdatedAt: defaults.lastUpdatedAt, estimatedTime: "2–4 weeks", estimatedTimeEs: "2–4 semanas", notes: "Fire suppression and egress.", notesEs: "Supresión de incendios y salidas de emergencia." },
  { id: "perm-environmental", name: "Environmental Clearance (DIA)", nameEs: "Autorización Ambiental (DIA)", agency: "Junta de Calidad Ambiental", responsible: "Andrea Camacho", state: defaults.state, lastUpdatedAt: defaults.lastUpdatedAt, estimatedTime: "8–16 weeks", estimatedTimeEs: "8–16 semanas", notes: "Environmental impact assessment.", notesEs: "Evaluación de impacto ambiental." },
];

export const PROJECT_PERMIT_AUTHORIZATIONS: Record<string, PermitAuthorization> = {
  "proj-1": { status: "none", summaryAccepted: false },
  "proj-2": { status: "authorized", authorizedBy: "Andrés Martínez", authorizedAt: "2025-09-15T10:00:00Z", authorizedIpMock: "73.144.22.108", summaryAccepted: true },
  "proj-3": { status: "authorized", authorizedBy: "Sofia Marrero", authorizedAt: "2025-04-20T10:00:00Z", authorizedIpMock: "70.45.180.221", summaryAccepted: true },
};

export const PROJECT_REQUIRED_SIGNATURES: Record<string, RequiredSignature[]> = {
  "proj-1": standardSignatures(),
  "proj-2": standardSignatures().map((s) => ({ ...s, signedBy: "Andrés Martínez", signedAt: "2025-09-16T11:00:00Z" })),
  "proj-3": standardSignatures().map((s) => ({ ...s, signedBy: "Sofia Marrero", signedAt: "2025-04-21T11:00:00Z" })),
};

// Mixed mid-flow demo states for proj-2 (showcases all UI paths).
const proj2Items = (() => {
  const items = permitItemsTemplate({ state: "approved", lastUpdatedAt: "2025-10-30T15:00:00Z" });
  // perm-arpe-use → in_review
  const arpe = items.find((i) => i.id === "perm-arpe-use");
  if (arpe) { arpe.state = "in_review"; arpe.lastUpdatedAt = "2025-11-12T10:30:00Z"; }
  // perm-environmental → revision_requested with note
  const env = items.find((i) => i.id === "perm-environmental");
  if (env) {
    env.state = "revision_requested";
    env.lastUpdatedAt = "2025-11-18T09:00:00Z";
    env.revisionNote = "JCA requested an updated stormwater management plan and additional soil samples.";
    env.revisionNoteEs = "JCA solicitó plan actualizado de manejo pluvial y muestras de suelo adicionales.";
  }
  return items;
})();

export const PROJECT_PERMIT_ITEMS: Record<string, PermitItem[]> = {
  "proj-1": permitItemsTemplate({ state: "not_submitted" }),
  "proj-2": proj2Items,
  "proj-3": permitItemsTemplate({ state: "approved", lastUpdatedAt: "2025-05-30T15:00:00Z" }),
};
