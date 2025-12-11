export const services = [
  {
    id: "ct-mri",
    title: "CT/MRI Анализ",
    description: "Анализ медицинских изображений с помощью ИИ",
    longDescription: "Deep Learning анализ снимков мозга для ранней диагностики нейродегенеративных заболеваний",
    iconName: "Scan",
    href: "/dashboard/ct-mri",
    embedUrl: null, // URL сервиса от команды S1
    team: ["Murat", "Adilet"],
    status: "active" as const,
  },
  {
    id: "iot",
    title: "IoT Мониторинг",
    description: "Мониторинг показателей здоровья в реальном времени",
    longDescription: "PPG, IMU, EMG сенсоры для мониторинга стресса и состояния нервной системы",
    iconName: "Activity",
    href: "/dashboard/iot",
    embedUrl: null, // URL сервиса от команды S2
    team: ["Mukhammedzhan"],
    status: "active" as const,
  },
  {
    id: "questionnaire",
    title: "Опросники",
    description: "Интерактивные диагностические опросники",
    longDescription: "AI-анализ опросников для оценки уровня стресса и риска заболеваний",
    iconName: "ClipboardList",
    href: "/dashboard/questionnaire",
    embedUrl: null, // URL сервиса от команды S3
    team: ["Mukhammedzhan"],
    status: "active" as const,
  },
  {
    id: "genetics",
    title: "Генетический анализ",
    description: "Анализ генетических данных для диагностики",
    longDescription: "AlphaFold и ESMFold для анализа генетических данных и прогнозирования структуры белков",
    iconName: "Dna",
    href: "/dashboard/genetics",
    embedUrl: null,
    team: ["Bekzat", "Kaisar"],
    status: "active" as const,
  },
  {
    id: "blood",
    title: "Анализ крови",
    description: "Интерпретация результатов анализа крови",
    longDescription: "ML-анализ показателей крови для выявления биомаркеров нейродегенеративных заболеваний",
    iconName: "Droplets",
    href: "/dashboard/blood",
    embedUrl: null,
    team: ["Nursultan", "Damir"],
    status: "active" as const,
  },
  {
    id: "rehabilitation",
    title: "Реабилитация",
    description: "Персонализированные программы восстановления",
    longDescription: "YOLO и Computer Vision для отслеживания движений и персонализированной нейрореабилитации",
    iconName: "HeartPulse",
    href: "/dashboard/rehabilitation",
    embedUrl: null, // URL сервиса от команды S6
    team: ["Murat", "Adilet"],
    status: "active" as const,
  },
]

export type Service = typeof services[number]
export type ServiceStatus = "active" | "coming" | "maintenance"
