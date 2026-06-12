import { neuroguardService } from "./neuroguard-service"
import { normalizeAppLocale, type AppLocale } from "@/lib/app-locale"

type LocalizedServiceCopy = {
  title: string
  description: string
  longDescription: string
}

type ServiceDefinition = {
  id: string
  iconName: string
  href: string
  embedUrl: string | null
  team: string[]
  status: "active" | "coming" | "maintenance"
  externalUrl?: string
  copy: Record<AppLocale, LocalizedServiceCopy>
}

const serviceDefinitions: ServiceDefinition[] = [
  {
    id: "mri-classification",
    iconName: "ScanLine",
    href: "/dashboard/mri-classification",
    embedUrl: "https://classification.aman-ai.kz",
    team: ["Murat"],
    status: "active",
    copy: {
      ru: {
        title: "MRI Классификация",
        description: "Deep Learning классификация МРТ снимков",
        longDescription:
          "Deep Learning классификация МРТ изображений для диагностики нейродегенеративных заболеваний",
      },
      en: {
        title: "MRI Classification",
        description: "Deep learning classification of MRI scans",
        longDescription:
          "Deep learning MRI image classification for neurodegenerative disease diagnostics",
      },
      kk: {
        title: "MRI Жіктеу",
        description: "МРТ кескіндерін deep learning арқылы жіктеу",
        longDescription:
          "Нейродегенеративті ауруларды диагностикалау үшін МРТ кескіндерін deep learning арқылы жіктеу",
      },
    },
  },
  {
    id: "mri-seg-static",
    iconName: "BrainCircuit",
    href: "/dashboard/mri-seg-static",
    embedUrl: "https://seg-stat.aman-ai.kz",
    team: ["Murat"],
    status: "active",
    copy: {
      ru: {
        title: "MRI Сегментация (Static)",
        description: "Статическая сегментация МРТ снимков",
        longDescription: "Сегментация областей мозга для выявления патологий",
      },
      en: {
        title: "MRI Segmentation (Static)",
        description: "Static MRI scan segmentation",
        longDescription: "Brain region segmentation for pathology detection",
      },
      kk: {
        title: "MRI Сегментация (Static)",
        description: "МРТ кескіндерін статикалық сегментациялау",
        longDescription: "Патологияларды анықтау үшін ми аймақтарын сегментациялау",
      },
    },
  },
  {
    id: "mri-seg-adaptive",
    iconName: "Brain",
    href: "/dashboard/mri-seg-adaptive",
    embedUrl: "https://seg-adap.aman-ai.kz",
    team: ["Murat"],
    status: "active",
    copy: {
      ru: {
        title: "MRI Сегментация (Adaptive)",
        description: "Адаптивная сегментация МРТ снимков",
        longDescription: "Адаптивная сегментация с постоянным улучшением модели",
      },
      en: {
        title: "MRI Segmentation (Adaptive)",
        description: "Adaptive MRI scan segmentation",
        longDescription: "Adaptive segmentation with continuous model improvement",
      },
      kk: {
        title: "MRI Сегментация (Adaptive)",
        description: "МРТ кескіндерін бейімделетін сегментациялау",
        longDescription: "Модельді үздіксіз жетілдіретін бейімделетін сегментация",
      },
    },
  },
  {
    id: "ml-static",
    iconName: "FlaskConical",
    href: "/dashboard/ml-static",
    embedUrl: "https://ml-stat.aman-ai.kz",
    team: ["Adilet"],
    status: "active",
    copy: {
      ru: {
        title: "ML Анализ (Static)",
        description: "Статический ML анализ данных",
        longDescription: "Машинное обучение для анализа медицинских данных",
      },
      en: {
        title: "ML Analysis (Static)",
        description: "Static ML data analysis",
        longDescription: "Machine learning for medical data analysis",
      },
      kk: {
        title: "ML Талдау (Static)",
        description: "Деректерді статикалық ML талдауы",
        longDescription: "Медициналық деректерді талдауға арналған машиналық оқыту",
      },
    },
  },
  {
    id: "ml-adaptive",
    iconName: "TestTube2",
    href: "/dashboard/ml-adaptive",
    embedUrl: "https://ml-adap.aman-ai.kz",
    team: ["Adilet"],
    status: "active",
    copy: {
      ru: {
        title: "ML Анализ (Adaptive)",
        description: "Адаптивный ML анализ данных",
        longDescription: "Адаптивное машинное обучение с автоматической донастройкой",
      },
      en: {
        title: "ML Analysis (Adaptive)",
        description: "Adaptive ML data analysis",
        longDescription: "Adaptive machine learning with automatic fine-tuning",
      },
      kk: {
        title: "ML Талдау (Adaptive)",
        description: "Деректерді бейімделетін ML талдауы",
        longDescription: "Автоматты реттеуі бар бейімделетін машиналық оқыту",
      },
    },
  },
  {
    id: "iot",
    iconName: "Waves",
    href: "/dashboard/iot",
    embedUrl: "https://amanai.kz/iot-embed/",
    team: ["Mukhammedzhan"],
    status: "active",
    copy: {
      ru: {
        title: "IoT Мониторинг",
        description: "Мониторинг показателей здоровья в реальном времени",
        longDescription:
          "PPG, IMU, EMG сенсоры для мониторинга стресса и состояния нервной системы",
      },
      en: {
        title: "IoT Monitoring",
        description: "Real-time health metrics monitoring",
        longDescription:
          "PPG, IMU, and EMG sensors for stress and nervous-system monitoring",
      },
      kk: {
        title: "IoT Мониторингі",
        description: "Денсаулық көрсеткіштерін нақты уақытта бақылау",
        longDescription:
          "Стресс пен жүйке жүйесінің күйін бақылауға арналған PPG, IMU, EMG сенсорлары",
      },
    },
  },
  {
    id: "questionnaire",
    iconName: "ClipboardList",
    href: "/dashboard/questionnaire",
    embedUrl: null,
    team: ["Mukhammedzhan"],
    status: "active",
    copy: {
      ru: {
        title: "Анамнез жизни",
        description: "Сбор и анализ истории болезни пациента",
        longDescription:
          "AI-анализ анамнеза для оценки факторов риска и персонализированной диагностики",
      },
      en: {
        title: "Life history",
        description: "Collect and analyze the patient's medical history",
        longDescription:
          "AI analysis of patient history for risk assessment and personalized diagnostics",
      },
      kk: {
        title: "Өмір анамнезі",
        description: "Пациенттің ауру тарихын жинау және талдау",
        longDescription:
          "Тәуекел факторларын бағалау және жеке диагностика үшін анамнезді AI талдауы",
      },
    },
  },
  {
    id: "cv-analysis",
    iconName: "PersonStanding",
    href: "/dashboard/cv-analysis",
    embedUrl: "https://cv.amanai.com.kz",
    team: ["Mukhammedzhan"],
    status: "active",
    copy: {
      ru: {
        title: "CV Анализ",
        description: "Computer Vision анализ движений",
        longDescription: "Анализ движений и поз с помощью компьютерного зрения",
      },
      en: {
        title: "CV Analysis",
        description: "Computer vision motion analysis",
        longDescription: "Analyze movement and posture with computer vision",
      },
      kk: {
        title: "CV Талдау",
        description: "Қимылдарды computer vision арқылы талдау",
        longDescription: "Қозғалыс пен қалыпты компьютерлік көру арқылы талдау",
      },
    },
  },
  {
    id: "genetics",
    iconName: "Dna",
    href: "/dashboard/genetics",
    embedUrl: null,
    team: ["Samiullah", "Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "Генетический анализ",
        description: "Анализ генетических данных для диагностики",
        longDescription:
          "AlphaFold и ESMFold для анализа генетических данных и прогнозирования структуры белков",
      },
      en: {
        title: "Genetic analysis",
        description: "Analyze genetic data for diagnostics",
        longDescription:
          "Use AlphaFold and ESMFold for genetic analysis and protein-structure prediction",
      },
      kk: {
        title: "Генетикалық талдау",
        description: "Диагностика үшін генетикалық деректерді талдау",
        longDescription:
          "Генетикалық деректерді талдау және ақуыз құрылымын болжау үшін AlphaFold пен ESMFold қолдану",
      },
    },
  },
  {
    id: "alphafold",
    iconName: "Atom",
    href: "/dashboard/alphafold",
    embedUrl: null,
    externalUrl: "https://alphafoldserver.com",
    team: ["Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "AlphaFold Server",
        description: "3D структура белков от DeepMind",
        longDescription:
          "Официальный AlphaFold Server для предсказания 3D структуры белков по аминокислотной последовательности",
      },
      en: {
        title: "AlphaFold Server",
        description: "DeepMind protein 3D structure service",
        longDescription:
          "Official AlphaFold Server for predicting 3D protein structures from amino-acid sequences",
      },
      kk: {
        title: "AlphaFold Server",
        description: "DeepMind ұсынған ақуыздардың 3D құрылымы",
        longDescription:
          "Аминқышқыл тізбегі бойынша ақуыздың 3D құрылымын болжауға арналған ресми AlphaFold Server",
      },
    },
  },
  {
    id: "blood",
    iconName: "Syringe",
    href: "/dashboard/blood",
    embedUrl: null,
    team: ["Samiullah", "Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "Анализ крови",
        description: "Интерпретация результатов анализа крови",
        longDescription:
          "ML-анализ показателей крови для выявления биомаркеров нейродегенеративных заболеваний",
      },
      en: {
        title: "Blood analysis",
        description: "Interpret blood test results",
        longDescription:
          "ML analysis of blood markers for neurodegenerative disease biomarker detection",
      },
      kk: {
        title: "Қан талдауы",
        description: "Қан талдауы нәтижелерін түсіндіру",
        longDescription:
          "Нейродегенеративті аурулар биомаркерлерін анықтау үшін қан көрсеткіштерін ML талдауы",
      },
    },
  },
  {
    id: "library",
    iconName: "BookOpen",
    href: "/dashboard/library",
    embedUrl: null,
    team: ["Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "Библиотека",
        description: "Образовательные и релаксационные материалы",
        longDescription: "Видео, аудио и статьи для обучения, релаксации и улучшения сна",
      },
      en: {
        title: "Library",
        description: "Educational and relaxation materials",
        longDescription: "Videos, audio, and articles for learning, relaxation, and better sleep",
      },
      kk: {
        title: "Кітапхана",
        description: "Білім беру және релаксация материалдары",
        longDescription: "Оқу, релаксация және ұйқыны жақсартуға арналған видео, аудио және мақалалар",
      },
    },
  },
  {
    id: "voice",
    iconName: "Mic",
    href: "/dashboard/voice",
    embedUrl: null,
    team: ["Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "Голосовой помощник",
        description: "Голосовой AI-ассистент на казахском и русском",
        longDescription:
          "Общайтесь с AI на казахском или русском языке. Распознавание речи и голосовые ответы.",
      },
      en: {
        title: "Voice assistant",
        description: "Voice AI assistant in Kazakh and Russian",
        longDescription:
          "Speak with AI in Kazakh or Russian with speech recognition and voice responses.",
      },
      kk: {
        title: "Дауыстық көмекші",
        description: "Қазақ және орыс тілдеріндегі AI дауыстық көмекші",
        longDescription:
          "AI-мен қазақша немесе орысша сөйлесіңіз. Сөйлеуді тану және дауыстық жауаптар қолжетімді.",
      },
    },
  },
  {
    id: "consultation",
    iconName: "AudioLines",
    href: "/dashboard/consultation",
    embedUrl: null,
    team: ["Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "Запись консультации",
        description: "Запись и анализ разговора врача с пациентом",
        longDescription:
          "Записывайте консультации — AI расшифрует диалог, разделит врача и пациента, создаст структурированное заключение",
      },
      en: {
        title: "Consultation recording",
        description: "Record and analyze doctor-patient conversations",
        longDescription:
          "Record consultations while AI transcribes the dialogue, separates speakers, and builds a structured summary",
      },
      kk: {
        title: "Кеңес жазбасы",
        description: "Дәрігер мен пациент әңгімесін жазу және талдау",
        longDescription:
          "Кеңестерді жазыңыз: AI диалогты мәтінге айналдырып, дәрігер мен пациентті бөліп, құрылымдалған қорытынды жасайды",
      },
    },
  },
  {
    ...neuroguardService,
    copy: {
      ru: {
        title: neuroguardService.title,
        description: neuroguardService.description,
        longDescription: neuroguardService.longDescription,
      },
      en: {
        title: "NeuroGuard",
        description: "Neurological safety monitoring",
        longDescription: "AI-assisted neurological safety monitoring and decision support",
      },
      kk: {
        title: "NeuroGuard",
        description: "Неврологиялық қауіпсіздік мониторингі",
        longDescription: "AI көмегімен неврологиялық қауіпсіздікті бақылау және шешім қолдауы",
      },
    },
  },
  {
    id: "zhurek",
    iconName: "HeartPulse",
    href: "/dashboard/zhurek",
    embedUrl: "https://zhurekai.kz/embed",
    team: ["Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "Zhurek AI",
        description: "Мониторинг здоровья сердца с IoT и ML",
        longDescription:
          "AI-платформа для мониторинга сердечно-сосудистой системы: HR, HRV, SpO2 в реальном времени с персональной оценкой рисков",
      },
      en: {
        title: "Zhurek AI",
        description: "Heart-health monitoring with IoT and ML",
        longDescription:
          "AI platform for cardiovascular monitoring: HR, HRV, and SpO2 in real time with personalized risk scoring",
      },
      kk: {
        title: "Zhurek AI",
        description: "IoT және ML арқылы жүрек денсаулығын бақылау",
        longDescription:
          "Жүрек-қантамыр жүйесін бақылауға арналған AI платформа: HR, HRV, SpO2 нақты уақытта және жеке тәуекел бағасы",
      },
    },
  },
  {
    id: "sana",
    iconName: "Moon",
    href: "/dashboard/sana",
    embedUrl: "https://sana-ai.kz/embed",
    team: ["Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "Sana AI",
        description: "AI-мониторинг и анализ качества сна",
        longDescription:
          "Интеллектуальный анализ сна с рекомендациями по улучшению — IoT-датчики и AI для оценки фаз сна и выявления нарушений",
      },
      en: {
        title: "Sana AI",
        description: "AI monitoring and sleep-quality analysis",
        longDescription:
          "Intelligent sleep analysis with improvement guidance using IoT sensors and AI for sleep-phase and disorder detection",
      },
      kk: {
        title: "Sana AI",
        description: "Ұйқы сапасын AI арқылы бақылау және талдау",
        longDescription:
          "Ұйқыны жақсарту бойынша ұсыныстары бар интеллектуалды талдау: фазалар мен бұзылыстарды бағалау үшін IoT сенсорлары мен AI",
      },
    },
  },
  {
    id: "zhan",
    iconName: "Eye",
    href: "/dashboard/zhan",
    embedUrl: "https://zhan-ai.kz/embed",
    team: ["Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "Zhan AI",
        description: "Скрининг миопии по фундус-фото (CDSS)",
        longDescription:
          "AI-система клинической поддержки принятия решений: скрининг миопии по снимку глазного дна (SwinV2-Tiny, AUC 0.946)",
      },
      en: {
        title: "Zhan AI",
        description: "Myopia screening from fundus photos (CDSS)",
        longDescription:
          "Clinical decision-support AI for myopia screening from retinal fundus images (SwinV2-Tiny, AUC 0.946)",
      },
      kk: {
        title: "Zhan AI",
        description: "Көз түбі суреті бойынша миопия скринингі (CDSS)",
        longDescription:
          "Клиникалық шешім қабылдауды қолдайтын AI жүйесі: көз түбі суреті бойынша миопия скринингі (SwinV2-Tiny, AUC 0.946)",
      },
    },
  },
  {
    id: "medtwin",
    iconName: "Stethoscope",
    href: "/dashboard/medtwin",
    embedUrl: "https://medtwin.kz",
    team: ["Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "MedTwin",
        description: "Цифровой помощник врача",
        longDescription:
          "Цифровой двойник пациента: транскрипция приёма, автоматическая выписка и анализ данных в реальном времени",
      },
      en: {
        title: "MedTwin",
        description: "Digital doctor assistant",
        longDescription:
          "Digital patient twin: visit transcription, automatic discharge draft, and real-time data analysis",
      },
      kk: {
        title: "MedTwin",
        description: "Дәрігердің цифрлық көмекшісі",
        longDescription:
          "Пациенттің цифрлық егізі: қабылдауды транскрипциялау, автоматты қорытынды және нақты уақыттағы деректер талдауы",
      },
    },
  },
  {
    id: "reports",
    iconName: "FileText",
    href: "/dashboard/reports",
    embedUrl: null,
    team: ["Alnur"],
    status: "active",
    copy: {
      ru: {
        title: "Отчёты",
        description: "Медицинские отчёты, созданные AI",
        longDescription: "Автоматически сгенерированные медицинские отчёты и экспорт результата",
      },
      en: {
        title: "Reports",
        description: "Medical reports generated by AI",
        longDescription: "Automatically generated medical reports and result export",
      },
      kk: {
        title: "Есептер",
        description: "AI жасаған медициналық есептер",
        longDescription: "Автоматты түрде жасалған медициналық есептер және нәтижені экспорттау",
      },
    },
  },
]

export function getLocalizedServices(localeLike?: string | null) {
  const locale = normalizeAppLocale(localeLike)

  return serviceDefinitions.map(({ copy, ...service }) => ({
    ...service,
    ...copy[locale],
  }))
}

export const services = getLocalizedServices("ru")

export type Service = ReturnType<typeof getLocalizedServices>[number]
export type ServiceStatus = Service["status"]
