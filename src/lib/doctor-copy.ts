import { type AppLocale, normalizeAppLocale } from "@/lib/app-locale"

type DoctorCopy = {
  common: {
    searchPlaceholder: string
    profileFallback: string
    language: string
    localeNames: Record<AppLocale, string>
    unknownPatient: string
    roles: {
      patient: string
      doctor: string
      admin: string
    }
  }
  sidebar: {
    dashboard: string
    patients: string
    worklist: string
    reviews: string
    reports: string
    users: string
    stats: string
    services: string
    history: string
    profile: string
    settings: string
    signOut: string
  }
  worklist: {
    navTitle: string
    pageTitle: string
    subtitle: string
    reviewQueue: string
    casesLabel: string
    fallbackBanner: string
    patient: string
    studyType: string
    priority: string
    status: string
    aiSummary: string
    updated: string
    open: string
    emptyTitle: string
    emptyDescription: string
    noSummary: string
    priorities: {
      critical: string
      high: string
      normal: string
    }
    statuses: {
      pending: string
      processing: string
      completed: string
      reviewed: string
      failed: string
    }
    studyTypes: {
      ctMri: string
      iot: string
      questionnaire: string
      genetics: string
      blood: string
      rehabilitation: string
    }
    mockSummaries: {
      criticalMri: string
      highIot: string
      normalQuestionnaire: string
    }
  }
  caseDetail: {
    pageTitle: string
    backToWorklist: string
    studyType: string
    priority: string
    status: string
    aiSummary: string
    updated: string
  }
  patientDetail: {
    pageTitle: string
    backToPatients: string
    mockBanner: string
    phone: string
    analyses: string
    source: string
    notes: string
    sourcePrisma: string
    sourceMock: string
    dbNote: string
    mockNotes: {
      localMock: string
      assignments: string
      history: string
      safePlaceholder: string
    }
  }
}

const doctorCopy: Record<AppLocale, DoctorCopy> = {
  ru: {
    common: {
      searchPlaceholder: "Поиск...",
      profileFallback: "Профиль",
      language: "Язык",
      localeNames: {
        ru: "Русский",
        en: "English",
        kk: "Қазақша",
      },
      unknownPatient: "Без имени",
      roles: {
        patient: "Пациент",
        doctor: "Врач",
        admin: "Администратор",
      },
    },
    sidebar: {
      dashboard: "Главная",
      patients: "Пациенты",
      worklist: "Список врача",
      reviews: "На проверку",
      reports: "Отчёты",
      users: "Пользователи",
      stats: "Статистика",
      services: "Сервисы",
      history: "История",
      profile: "Профиль",
      settings: "Настройки",
      signOut: "Выйти",
    },
    worklist: {
      navTitle: "Список врача",
      pageTitle: "Список врача",
      subtitle: "Случаи отсортированы сначала по приоритету, затем по времени последнего обновления.",
      reviewQueue: "Очередь на проверку",
      casesLabel: "случаев",
      fallbackBanner:
        "TODO: заменить резервный mock-worklist данными Prisma по пациентам врача, когда локальная база стабильно содержит назначенные случаи.",
      patient: "Пациент",
      studyType: "Тип исследования",
      priority: "Приоритет",
      status: "Статус",
      aiSummary: "Сводка AI-находок",
      updated: "Обновлено",
      open: "Открыть",
      emptyTitle: "В списке пока нет случаев",
      emptyDescription: "Новые случаи для врачебной проверки появятся здесь автоматически.",
      noSummary: "Сводка AI пока недоступна.",
      priorities: {
        critical: "Критический",
        high: "Высокий",
        normal: "Нормальный",
      },
      statuses: {
        pending: "Ожидает",
        processing: "Обрабатывается",
        completed: "Завершено",
        reviewed: "Проверено",
        failed: "Ошибка",
      },
      studyTypes: {
        ctMri: "КТ / МРТ",
        iot: "IoT",
        questionnaire: "Анкета",
        genetics: "Генетика",
        blood: "Кровь",
        rehabilitation: "Реабилитация",
      },
      mockSummaries: {
        criticalMri: "Выраженные изменения в лобно-теменной зоне. Требуется срочный просмотр врача.",
        highIot: "Устойчиво повышенный стресс и сниженный HRV за последние 30 минут.",
        normalQuestionnaire: "Умеренный уровень симптомов без красных флагов по анкете.",
      },
    },
    caseDetail: {
      pageTitle: "Детали случая",
      backToWorklist: "Назад к списку",
      studyType: "Тип исследования",
      priority: "Приоритет",
      status: "Статус",
      aiSummary: "Сводка AI-находок",
      updated: "Обновлено",
    },
    patientDetail: {
      pageTitle: "Карточка пациента",
      backToPatients: "Назад к пациентам",
      mockBanner:
        "TODO: подключить эту карточку пациента к реальным данным назначенных пациентов, когда локальные врачебные назначения будут полностью заполнены.",
      phone: "Телефон",
      analyses: "Анализы",
      source: "Источник",
      notes: "Заметки",
      sourcePrisma: "Prisma",
      sourceMock: "Mock",
      dbNote: "Карточка пациента загружена из Prisma. Расширенные врачебные действия можно добавить отдельно.",
      mockNotes: {
        localMock: "Пациент из локального mock-набора. Подробная карточка будет заменена связью с Prisma-профилем.",
        assignments: "Нужна синхронизация с фактическими назначениями doctor_patient.",
        history: "Сюда можно будет добавить историю анализов и ревью врача.",
        safePlaceholder: "Пока это безопасный placeholder без дополнительных API-вызовов.",
      },
    },
  },
  en: {
    common: {
      searchPlaceholder: "Search...",
      profileFallback: "Profile",
      language: "Language",
      localeNames: {
        ru: "Russian",
        en: "English",
        kk: "Kazakh",
      },
      unknownPatient: "Unknown patient",
      roles: {
        patient: "Patient",
        doctor: "Doctor",
        admin: "Administrator",
      },
    },
    sidebar: {
      dashboard: "Dashboard",
      patients: "Patients",
      worklist: "Worklist",
      reviews: "Review queue",
      reports: "Reports",
      users: "Users",
      stats: "Statistics",
      services: "Services",
      history: "History",
      profile: "Profile",
      settings: "Settings",
      signOut: "Sign out",
    },
    worklist: {
      navTitle: "Worklist",
      pageTitle: "Doctor worklist",
      subtitle: "Cases are sorted by priority first, then by the most recent update.",
      reviewQueue: "Review queue",
      casesLabel: "cases",
      fallbackBanner:
        "TODO: replace the fallback mock worklist with doctor-scoped Prisma data once assigned patient cases exist consistently in the local database.",
      patient: "Patient",
      studyType: "Study type",
      priority: "Priority",
      status: "Status",
      aiSummary: "AI finding summary",
      updated: "Updated",
      open: "Open",
      emptyTitle: "No cases in the worklist",
      emptyDescription: "New doctor-triage cases will appear here automatically.",
      noSummary: "AI summary is not available yet.",
      priorities: {
        critical: "Critical",
        high: "High",
        normal: "Normal",
      },
      statuses: {
        pending: "Pending",
        processing: "Processing",
        completed: "Completed",
        reviewed: "Reviewed",
        failed: "Failed",
      },
      studyTypes: {
        ctMri: "CT / MRI",
        iot: "IoT",
        questionnaire: "Questionnaire",
        genetics: "Genetics",
        blood: "Blood",
        rehabilitation: "Rehabilitation",
      },
      mockSummaries: {
        criticalMri: "Marked changes in the frontoparietal region. Urgent doctor review is required.",
        highIot: "Persistently elevated stress and reduced HRV over the last 30 minutes.",
        normalQuestionnaire: "Moderate symptom level with no red flags in the questionnaire.",
      },
    },
    caseDetail: {
      pageTitle: "Case detail",
      backToWorklist: "Back to worklist",
      studyType: "Study type",
      priority: "Priority",
      status: "Status",
      aiSummary: "AI finding summary",
      updated: "Updated",
    },
    patientDetail: {
      pageTitle: "Patient card",
      backToPatients: "Back to patients",
      mockBanner:
        "TODO: wire this patient card to the real assigned-patient dataset once local doctor assignments are fully populated.",
      phone: "Phone",
      analyses: "Analyses",
      source: "Source",
      notes: "Notes",
      sourcePrisma: "Prisma",
      sourceMock: "Mock",
      dbNote: "This patient card was loaded from Prisma. Expanded doctor actions can be added separately.",
      mockNotes: {
        localMock: "This patient comes from the local mock dataset. The detailed card will be replaced with a Prisma-linked profile.",
        assignments: "Synchronization with actual doctor_patient assignments is still needed.",
        history: "Analysis history and doctor review notes can be added here later.",
        safePlaceholder: "This is currently a safe placeholder without additional API calls.",
      },
    },
  },
  kk: {
    common: {
      searchPlaceholder: "Іздеу...",
      profileFallback: "Профиль",
      language: "Тіл",
      localeNames: {
        ru: "Орысша",
        en: "English",
        kk: "Қазақша",
      },
      unknownPatient: "Аты жоқ",
      roles: {
        patient: "Пациент",
        doctor: "Дәрігер",
        admin: "Әкімші",
      },
    },
    sidebar: {
      dashboard: "Басты бет",
      patients: "Пациенттер",
      worklist: "Дәрігер тізімі",
      reviews: "Тексеру кезегі",
      reports: "Есептер",
      users: "Пайдаланушылар",
      stats: "Статистика",
      services: "Сервистер",
      history: "Тарих",
      profile: "Профиль",
      settings: "Баптаулар",
      signOut: "Шығу",
    },
    worklist: {
      navTitle: "Дәрігер тізімі",
      pageTitle: "Дәрігер тізімі",
      subtitle: "Жағдайлар алдымен басымдық бойынша, кейін соңғы жаңарту уақыты бойынша сұрыпталады.",
      reviewQueue: "Тексеру кезегі",
      casesLabel: "жағдай",
      fallbackBanner:
        "TODO: жергілікті базада дәрігерге бекітілген жағдайлар тұрақты болғанда, резервтік mock worklist орнына Prisma деректерін пайдалану.",
      patient: "Пациент",
      studyType: "Зерттеу түрі",
      priority: "Басымдық",
      status: "Күйі",
      aiSummary: "AI қорытындысы",
      updated: "Жаңартылды",
      open: "Ашу",
      emptyTitle: "Тізімде әзірге жағдай жоқ",
      emptyDescription: "Дәрігер тексеретін жаңа жағдайлар осы жерде автоматты түрде пайда болады.",
      noSummary: "AI қорытындысы әзірге қолжетімсіз.",
      priorities: {
        critical: "Критикалық",
        high: "Жоғары",
        normal: "Қалыпты",
      },
      statuses: {
        pending: "Күтуде",
        processing: "Өңделуде",
        completed: "Аяқталды",
        reviewed: "Тексерілді",
        failed: "Қате",
      },
      studyTypes: {
        ctMri: "КТ / МРТ",
        iot: "IoT",
        questionnaire: "Сауалнама",
        genetics: "Генетика",
        blood: "Қан",
        rehabilitation: "Оңалту",
      },
      mockSummaries: {
        criticalMri: "Маңдай-төбе аймағында айқын өзгерістер бар. Дәрігердің шұғыл қарауы қажет.",
        highIot: "Соңғы 30 минутта стресс тұрақты жоғарылап, HRV төмендеген.",
        normalQuestionnaire: "Сауалнамада қызыл жалаушаларсыз орташа симптом деңгейі анықталды.",
      },
    },
    caseDetail: {
      pageTitle: "Жағдай деректері",
      backToWorklist: "Тізімге оралу",
      studyType: "Зерттеу түрі",
      priority: "Басымдық",
      status: "Күйі",
      aiSummary: "AI қорытындысы",
      updated: "Жаңартылды",
    },
    patientDetail: {
      pageTitle: "Пациент картасы",
      backToPatients: "Пациенттерге оралу",
      mockBanner:
        "TODO: жергілікті дәрігер тағайындаулары толық толтырылғанда, бұл пациент картасын нақты тағайындалған пациент деректеріне қосу.",
      phone: "Телефон",
      analyses: "Талдаулар",
      source: "Дерек көзі",
      notes: "Ескертпелер",
      sourcePrisma: "Prisma",
      sourceMock: "Mock",
      dbNote: "Пациент картасы Prisma-дан жүктелді. Дәрігерге арналған кеңейтілген әрекеттерді кейін бөлек қосуға болады.",
      mockNotes: {
        localMock: "Бұл пациент жергілікті mock жинағынан алынған. Толық карта кейін Prisma профилімен байланысады.",
        assignments: "Нақты doctor_patient тағайындауларымен синхрондау әлі қажет.",
        history: "Мұнда кейін талдау тарихын және дәрігердің тексеру жазбаларын қосуға болады.",
        safePlaceholder: "Қазір бұл қосымша API шақыруларынсыз қауіпсіз placeholder болып тұр.",
      },
    },
  },
}

export type { DoctorCopy }

export function getDoctorCopy(localeLike?: string | null): DoctorCopy {
  return doctorCopy[normalizeAppLocale(localeLike)]
}
