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
    viewerTitle: string
    viewerDescription: string
    viewerUnavailable: string
    viewerUnavailableHint: string
    sequences: string
    sequenceLabels: {
      t1: string
      t2: string
      flair: string
      swi: string
    }
    sliceControl: string
    zoomControls: string
    zoomOut: string
    zoomReset: string
    zoomIn: string
    windowControl: string
    levelControl: string
    metadataTitle: string
    metadata: {
      accession: string
      modality: string
      studyDate: string
      series: string
      slices: string
      source: string
      sourceValues: {
        pacsSyncPlaceholder: string
        structuredSourcePlaceholder: string
      }
    }
    aiPanelTitle: string
    aiGeneratedLabel: string
    draftFindings: string
    draftImpression: string
    structuredFindings: string
    evidenceList: string
    confidenceScore: string
    doctorReviewWarning: string
    aiWarningTitle: string
    generatedLabels: {
      urgentNeuroradiologyFinding: string
      neuroimagingReviewCandidate: string
      physiologicTrendAlert: string
      behavioralRiskScreeningSummary: string
      aiTriageSummary: string
    }
    draftPrefixes: {
      radiology: string
      unavailable: string
    }
    impressionTemplates: {
      critical: string
      high: string
      normal: string
    }
    structuredFindingLabels: {
      primarySignal: string
      supportingObservation: string
      reviewMode: string
    }
    structuredFindingFallbacks: {
      noFindings: string
      noSecondaryObservation: string
    }
    reviewModeValues: {
      radiology: string
      unavailable: string
    }
    evidenceNotes: {
      radiologyPlaceholder: string
      unavailableViewer: string
    }
    reportEditorTitle: string
    reportEditorDescription: string
    reportFields: {
      findings: string
      impression: string
    }
    reviewStatuses: {
      draft: string
      edited: string
      signed: string
    }
    signedBy: string
    signedAt: string
    readOnlyBanner: string
    dbFallbackBanner: string
    auditTimelineTitle: string
    auditEmpty: string
    auditActions: {
      aiDraftViewed: string
      reportEdited: string
      draftSaved: string
      aiDraftAccepted: string
      aiDraftRejected: string
      reportSignedOff: string
      criticalFindingAcknowledged: string
    }
    errorMessages: {
      reportReadOnly: string
      criticalAlreadyAcknowledged: string
      criticalAckRequired: string
      unsupportedReviewAction: string
      reviewPersistenceUnavailable: string
      updateFailed: string
    }
    criticalAlertTitle: string
    criticalAlertDescription: string
    criticalAcknowledged: string
    criticalAcknowledgedAt: string
    criticalAcknowledgeAction: string
    actionButtons: {
      editReport: string
      approve: string
      signOff: string
      saveDraft: string
      acceptAiDraft: string
      rejectAiDraft: string
    }
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
  reviewsPage: {
    pageTitle: string
    pendingHeading: string
    attentionSummary: string
    priorityLegend: {
      high: string
      medium: string
      low: string
    }
    aiConclusion: string
    confidence: string
    details: string
    comment: string
    reject: string
    confirm: string
    ageSuffix: string
    allReviewedTitle: string
    allReviewedDescription: string
    timeLabels: {
      twoHoursAgo: string
      fiveHoursAgo: string
      yesterday: string
    }
    mockCases: {
      brainMriTitle: string
      iotMonitoringTitle: string
      questionnaireTitle: string
      brainMriResult: string
      iotResult: string
      questionnaireResult: string
      brainMriFindings: [string, string]
      iotFindings: [string, string]
      questionnaireFindings: [string, string]
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
      viewerTitle: "Просмотр исследования",
      viewerDescription: "Плейсхолдер просмотра снимков для врачебного ревью без подключения реального DICOM-движка.",
      viewerUnavailable: "Просмотрщик недоступен для этого типа исследования",
      viewerUnavailableHint:
        "Метаданные исследования и AI-черновик остаются доступны. Реальный просмотрщик будет подключён отдельно.",
      sequences: "Последовательности",
      sequenceLabels: {
        t1: "T1",
        t2: "T2",
        flair: "FLAIR",
        swi: "SWI",
      },
      sliceControl: "Срез",
      zoomControls: "Масштаб",
      zoomOut: "Уменьшить",
      zoomReset: "Сбросить масштаб",
      zoomIn: "Увеличить",
      windowControl: "Окно",
      levelControl: "Уровень",
      metadataTitle: "Метаданные исследования",
      metadata: {
        accession: "Accession",
        modality: "Модальность",
        studyDate: "Дата исследования",
        series: "Серии",
        slices: "Срезы",
        source: "Источник",
        sourceValues: {
          pacsSyncPlaceholder: "Плейсхолдер PACS-синхронизации",
          structuredSourcePlaceholder: "Плейсхолдер структурированного источника",
        },
      },
      aiPanelTitle: "AI-панель",
      aiGeneratedLabel: "AI-метка",
      draftFindings: "Черновик находок",
      draftImpression: "Черновик заключения",
      structuredFindings: "Структурированные находки",
      evidenceList: "Список подтверждений",
      confidenceScore: "Уверенность",
      doctorReviewWarning: "AI-результат нельзя использовать без проверки врачом и окончательного клинического решения.",
      aiWarningTitle: "Обязательно проверьте результат AI",
      generatedLabels: {
        urgentNeuroradiologyFinding: "Вероятная срочная нейрорадиологическая находка",
        neuroimagingReviewCandidate: "Кандидат на нейровизуализационное ревью",
        physiologicTrendAlert: "Предупреждение о физиологическом тренде",
        behavioralRiskScreeningSummary: "Сводка скрининга поведенческого риска",
        aiTriageSummary: "AI-сводка для триажа",
      },
      draftPrefixes: {
        radiology: "Черновик визуального ревью: ",
        unavailable: "Черновик структурированного ревью: ",
      },
      impressionTemplates: {
        critical: "Обнаружен паттерн высокой срочности.",
        high: "Рекомендуется ускоренное ревью врачом.",
        normal: "Немедленный критический паттерн не обнаружен.",
      },
      structuredFindingLabels: {
        primarySignal: "Основной сигнал",
        supportingObservation: "Поддерживающее наблюдение",
        reviewMode: "Режим ревью",
      },
      structuredFindingFallbacks: {
        noFindings: "AI пока не вернул конкретные находки.",
        noSecondaryObservation: "Вторичное наблюдение пока не передано AI-конвейером.",
      },
      reviewModeValues: {
        radiology: "Активен плейсхолдер радиологического просмотрщика для покадрового ревью по последовательностям.",
        unavailable: "Активно состояние недоступного просмотрщика, поэтому ревью следует выполнять по метаданным и AI-сводке.",
      },
      evidenceNotes: {
        radiologyPlaceholder: "Вкладки последовательностей и элементы управления изображением пока остаются UI-плейсхолдером до интеграции PACS или DICOM.",
        unavailableViewer: "Для этого типа исследования радиологический просмотрщик пока недоступен, но AI-ревью остаётся доступным.",
      },
      reportEditorTitle: "Редактирование отчёта",
      reportEditorDescription: "Проверьте AI-черновик, при необходимости отредактируйте Findings и Impression, затем сохраните или подпишите отчёт.",
      reportFields: {
        findings: "Находки",
        impression: "Заключение",
      },
      reviewStatuses: {
        draft: "Черновик",
        edited: "Отредактировано",
        signed: "Подписано",
      },
      signedBy: "Подписал",
      signedAt: "Время подписи",
      readOnlyBanner: "После подписи поля становятся только для чтения.",
      dbFallbackBanner: "Не удалось сохранить врачебное ревью в базе данных. Показан резервный режим только для чтения.",
      auditTimelineTitle: "История аудита",
      auditEmpty: "Аудит событий для этого случая пока отсутствует.",
      auditActions: {
        aiDraftViewed: "AI-черновик открыт",
        reportEdited: "Отчёт изменён",
        draftSaved: "Черновик сохранён",
        aiDraftAccepted: "AI-черновик принят",
        aiDraftRejected: "AI-черновик отклонён",
        reportSignedOff: "Отчёт подписан",
        criticalFindingAcknowledged: "Критическая находка подтверждена",
      },
      errorMessages: {
        reportReadOnly: "Подписанный отчёт доступен только для чтения.",
        criticalAlreadyAcknowledged: "Критическая находка уже подтверждена.",
        criticalAckRequired: "Перед подписью нужно подтвердить критическую находку.",
        unsupportedReviewAction: "Это действие врачебного ревью не поддерживается.",
        reviewPersistenceUnavailable: "Не удалось сохранить врачебное ревью в базе данных.",
        updateFailed: "Не удалось обновить врачебное ревью.",
      },
      criticalAlertTitle: "Критическая находка требует подтверждения",
      criticalAlertDescription: "Подтвердите, что вы увидели критическую находку, прежде чем завершать ревью.",
      criticalAcknowledged: "Критическая находка подтверждена",
      criticalAcknowledgedAt: "Подтверждено",
      criticalAcknowledgeAction: "Подтвердить критическую находку",
      actionButtons: {
        editReport: "Редактировать отчёт",
        approve: "Подтвердить",
        signOff: "Подписать",
        saveDraft: "Сохранить черновик",
        acceptAiDraft: "Принять AI-черновик",
        rejectAiDraft: "Отклонить AI-черновик",
      },
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
    reviewsPage: {
      pageTitle: "Проверка анализов",
      pendingHeading: "Ожидают проверки",
      attentionSummary: "анализов требуют вашего внимания",
      priorityLegend: {
        high: "Высокий",
        medium: "Средний",
        low: "Низкий",
      },
      aiConclusion: "AI заключение",
      confidence: "уверенность",
      details: "Подробнее",
      comment: "Комментарий",
      reject: "Отклонить",
      confirm: "Подтвердить",
      ageSuffix: "лет",
      allReviewedTitle: "Все анализы проверены",
      allReviewedDescription: "Новые анализы появятся здесь автоматически",
      timeLabels: {
        twoHoursAgo: "2 часа назад",
        fiveHoursAgo: "5 часов назад",
        yesterday: "Вчера",
      },
      mockCases: {
        brainMriTitle: "МРТ головного мозга",
        iotMonitoringTitle: "IoT мониторинг (30 мин)",
        questionnaireTitle: "Опросник PSS-10",
        brainMriResult: "Выявлены признаки начальной стадии атрофии",
        iotResult: "Повышенный уровень стресса",
        questionnaireResult: "Умеренный уровень стресса",
        brainMriFindings: ["Лёгкая атрофия коры", "Расширение желудочков"],
        iotFindings: ["HRV: 35ms (низкий)", "Стресс: 68%"],
        questionnaireFindings: ["Балл: 21/40", "Категория: средний"],
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
      viewerTitle: "Study viewer",
      viewerDescription: "Imaging viewer placeholder for doctor review until the real DICOM engine is connected.",
      viewerUnavailable: "Viewer unavailable for this study type",
      viewerUnavailableHint:
        "Study metadata and the AI draft remain available. A dedicated viewer can be added separately later.",
      sequences: "Sequences",
      sequenceLabels: {
        t1: "T1",
        t2: "T2",
        flair: "FLAIR",
        swi: "SWI",
      },
      sliceControl: "Slice",
      zoomControls: "Zoom",
      zoomOut: "Zoom out",
      zoomReset: "Reset zoom",
      zoomIn: "Zoom in",
      windowControl: "Window",
      levelControl: "Level",
      metadataTitle: "Study metadata",
      metadata: {
        accession: "Accession",
        modality: "Modality",
        studyDate: "Study date",
        series: "Series",
        slices: "Slices",
        source: "Source",
        sourceValues: {
          pacsSyncPlaceholder: "PACS sync placeholder",
          structuredSourcePlaceholder: "Structured source placeholder",
        },
      },
      aiPanelTitle: "AI panel",
      aiGeneratedLabel: "AI generated label",
      draftFindings: "Draft findings",
      draftImpression: "Draft impression",
      structuredFindings: "Structured findings",
      evidenceList: "Evidence list",
      confidenceScore: "Confidence score",
      doctorReviewWarning:
        "AI output must be reviewed by a doctor before it is used in any report or clinical decision.",
      aiWarningTitle: "Doctor review is required",
      generatedLabels: {
        urgentNeuroradiologyFinding: "Probable urgent neuroradiology finding",
        neuroimagingReviewCandidate: "Neuroimaging review candidate",
        physiologicTrendAlert: "Physiologic trend alert",
        behavioralRiskScreeningSummary: "Behavioral risk screening summary",
        aiTriageSummary: "AI triage summary",
      },
      draftPrefixes: {
        radiology: "Imaging review draft: ",
        unavailable: "Structured review draft: ",
      },
      impressionTemplates: {
        critical: "High-acuity pattern detected.",
        high: "Expedited physician review is recommended.",
        normal: "No immediate critical pattern detected.",
      },
      structuredFindingLabels: {
        primarySignal: "Primary signal",
        supportingObservation: "Supporting observation",
        reviewMode: "Review mode",
      },
      structuredFindingFallbacks: {
        noFindings: "AI did not return specific findings yet.",
        noSecondaryObservation: "No secondary observation supplied by the AI pipeline.",
      },
      reviewModeValues: {
        radiology: "Radiology viewer placeholder active for sequence-by-sequence review.",
        unavailable: "Viewer unavailable state active; review should rely on metadata and the AI summary.",
      },
      evidenceNotes: {
        radiologyPlaceholder: "Sequence tabs and image controls are placeholder UI pending PACS or DICOM integration.",
        unavailableViewer: "This study type does not have a radiology viewer yet; AI review remains available.",
      },
      reportEditorTitle: "Report editor",
      reportEditorDescription: "Review the AI draft, edit Findings and Impression if needed, then save or sign the report.",
      reportFields: {
        findings: "Findings",
        impression: "Impression",
      },
      reviewStatuses: {
        draft: "Draft",
        edited: "Edited",
        signed: "Signed",
      },
      signedBy: "Signed by",
      signedAt: "Signed at",
      readOnlyBanner: "Signed reports are locked and read-only.",
      dbFallbackBanner: "Doctor review persistence is temporarily unavailable. A read-only fallback is being shown.",
      auditTimelineTitle: "Audit timeline",
      auditEmpty: "No audit events are recorded for this case yet.",
      auditActions: {
        aiDraftViewed: "AI draft viewed",
        reportEdited: "Report edited",
        draftSaved: "Draft saved",
        aiDraftAccepted: "AI draft accepted",
        aiDraftRejected: "AI draft rejected",
        reportSignedOff: "Report signed off",
        criticalFindingAcknowledged: "Critical finding acknowledged",
      },
      errorMessages: {
        reportReadOnly: "Signed reports are read-only.",
        criticalAlreadyAcknowledged: "Critical finding has already been acknowledged.",
        criticalAckRequired: "A critical finding must be acknowledged before sign-off.",
        unsupportedReviewAction: "This doctor review action is not supported.",
        reviewPersistenceUnavailable: "Doctor review persistence is unavailable.",
        updateFailed: "Doctor review update failed.",
      },
      criticalAlertTitle: "Critical finding requires acknowledgement",
      criticalAlertDescription: "Acknowledge that you have seen the critical finding before completing the review.",
      criticalAcknowledged: "Critical finding acknowledged",
      criticalAcknowledgedAt: "Acknowledged",
      criticalAcknowledgeAction: "Acknowledge critical finding",
      actionButtons: {
        editReport: "Edit report",
        approve: "Approve",
        signOff: "Sign off",
        saveDraft: "Save draft",
        acceptAiDraft: "Accept AI draft",
        rejectAiDraft: "Reject AI draft",
      },
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
    reviewsPage: {
      pageTitle: "Case reviews",
      pendingHeading: "Pending review",
      attentionSummary: "analyses require your attention",
      priorityLegend: {
        high: "High",
        medium: "Medium",
        low: "Low",
      },
      aiConclusion: "AI conclusion",
      confidence: "confidence",
      details: "Details",
      comment: "Comment",
      reject: "Reject",
      confirm: "Confirm",
      ageSuffix: "years old",
      allReviewedTitle: "All cases reviewed",
      allReviewedDescription: "New analyses will appear here automatically",
      timeLabels: {
        twoHoursAgo: "2 hours ago",
        fiveHoursAgo: "5 hours ago",
        yesterday: "Yesterday",
      },
      mockCases: {
        brainMriTitle: "Brain MRI",
        iotMonitoringTitle: "IoT monitoring (30 min)",
        questionnaireTitle: "PSS-10 questionnaire",
        brainMriResult: "Early-stage atrophy markers were detected",
        iotResult: "Elevated stress level detected",
        questionnaireResult: "Moderate stress level detected",
        brainMriFindings: ["Mild cortical atrophy", "Ventricular enlargement"],
        iotFindings: ["HRV: 35ms (low)", "Stress: 68%"],
        questionnaireFindings: ["Score: 21/40", "Category: medium"],
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
      viewerTitle: "Зерттеуді қарау",
      viewerDescription: "Нақты DICOM қозғалтқышы қосылғанға дейін дәрігерлік тексеруге арналған сурет қарау плейсхолдері.",
      viewerUnavailable: "Бұл зерттеу түрі үшін қарау құралы қолжетімсіз",
      viewerUnavailableHint:
        "Зерттеу метадеректері мен AI нобайы қолжетімді болып қалады. Арнайы қарау құралы кейін бөлек қосылады.",
      sequences: "Тізбектер",
      sequenceLabels: {
        t1: "T1",
        t2: "T2",
        flair: "FLAIR",
        swi: "SWI",
      },
      sliceControl: "Қима",
      zoomControls: "Масштаб",
      zoomOut: "Кішірейту",
      zoomReset: "Масштабты қалпына келтіру",
      zoomIn: "Үлкейту",
      windowControl: "Терезе",
      levelControl: "Деңгей",
      metadataTitle: "Зерттеу метадеректері",
      metadata: {
        accession: "Accession",
        modality: "Модальділік",
        studyDate: "Зерттеу күні",
        series: "Сериялар",
        slices: "Қималар",
        source: "Дерек көзі",
        sourceValues: {
          pacsSyncPlaceholder: "PACS синхрондау плейсхолдері",
          structuredSourcePlaceholder: "Құрылымдалған дерек көзі плейсхолдері",
        },
      },
      aiPanelTitle: "AI панелі",
      aiGeneratedLabel: "AI белгісі",
      draftFindings: "Қорытынды нобайы",
      draftImpression: "Түйін нобайы",
      structuredFindings: "Құрылымдалған қорытындылар",
      evidenceList: "Дәлелдер тізімі",
      confidenceScore: "Сенімділік деңгейі",
      doctorReviewWarning:
        "AI нәтижесін есепке немесе клиникалық шешімге қоспас бұрын дәрігер міндетті түрде тексеруі керек.",
      aiWarningTitle: "AI нәтижесін міндетті түрде тексеріңіз",
      generatedLabels: {
        urgentNeuroradiologyFinding: "Шұғыл нейрорадиологиялық белгі болуы ықтимал",
        neuroimagingReviewCandidate: "Нейровизуализациялық шолуға лайық жағдай",
        physiologicTrendAlert: "Физиологиялық тренд туралы ескерту",
        behavioralRiskScreeningSummary: "Мінез-құлық тәуекелін скрининг қорытындысы",
        aiTriageSummary: "AI триаж қорытындысы",
      },
      draftPrefixes: {
        radiology: "Визуалдық шолу нобайы: ",
        unavailable: "Құрылымдалған шолу нобайы: ",
      },
      impressionTemplates: {
        critical: "Жоғары жеделдікті үлгі анықталды.",
        high: "Дәрігердің жеделдетілген шолуы ұсынылады.",
        normal: "Дереу қауіп төндіретін критикалық үлгі анықталмады.",
      },
      structuredFindingLabels: {
        primarySignal: "Негізгі белгі",
        supportingObservation: "Қосымша бақылау",
        reviewMode: "Қарау режимі",
      },
      structuredFindingFallbacks: {
        noFindings: "AI әзірге нақты қорытынды қайтармады.",
        noSecondaryObservation: "Екінші бақылау AI құбырынан әлі берілген жоқ.",
      },
      reviewModeValues: {
        radiology: "Тізбек бойынша қарауға арналған радиология көрінісінің плейсхолдері белсенді.",
        unavailable: "Қарау құралы қолжетімсіз күйде, сондықтан шолу метадеректер мен AI қорытындысына сүйенуі керек.",
      },
      evidenceNotes: {
        radiologyPlaceholder: "Тізбек қойындылары мен суретті басқару элементтері PACS немесе DICOM интеграциясына дейін UI плейсхолдері болып қалады.",
        unavailableViewer: "Бұл зерттеу түрі үшін радиология қарау құралы әлі жоқ, бірақ AI шолуы қолжетімді.",
      },
      reportEditorTitle: "Есеп редакторы",
      reportEditorDescription: "AI нобайын тексеріп, қажет болса Findings пен Impression өрістерін түзетіңіз, содан кейін есепті сақтаңыз немесе қол қойыңыз.",
      reportFields: {
        findings: "Қорытындылар",
        impression: "Түйін",
      },
      reviewStatuses: {
        draft: "Нобай",
        edited: "Өңделді",
        signed: "Қол қойылды",
      },
      signedBy: "Қол қойған дәрігер",
      signedAt: "Қол қойылған уақыт",
      readOnlyBanner: "Қол қойылған есептер тек оқу режиміне өтеді.",
      dbFallbackBanner: "Дәрігерлік шолуды дерекқорға сақтау уақытша қолжетімсіз. Қазір тек оқуға арналған резервтік көрініс көрсетіледі.",
      auditTimelineTitle: "Аудит тарихы",
      auditEmpty: "Бұл жағдай үшін аудит оқиғалары әлі жазылмаған.",
      auditActions: {
        aiDraftViewed: "AI нобайы ашылды",
        reportEdited: "Есеп өңделді",
        draftSaved: "Нобай сақталды",
        aiDraftAccepted: "AI нобайы қабылданды",
        aiDraftRejected: "AI нобайы қабылданбады",
        reportSignedOff: "Есепке қол қойылды",
        criticalFindingAcknowledged: "Критикалық қорытынды расталды",
      },
      errorMessages: {
        reportReadOnly: "Қол қойылған есеп тек оқу үшін қолжетімді.",
        criticalAlreadyAcknowledged: "Критикалық қорытынды әлдеқашан расталған.",
        criticalAckRequired: "Қол қою алдында критикалық қорытындыны растау керек.",
        unsupportedReviewAction: "Дәрігерлік шолудың бұл әрекеті қолдау таппайды.",
        reviewPersistenceUnavailable: "Дәрігерлік шолуды дерекқорға сақтау қолжетімсіз.",
        updateFailed: "Дәрігерлік шолуды жаңарту мүмкін болмады.",
      },
      criticalAlertTitle: "Критикалық қорытындыны растау қажет",
      criticalAlertDescription: "Шолуды аяқтамас бұрын критикалық қорытындыны көргеніңізді растаңыз.",
      criticalAcknowledged: "Критикалық қорытынды расталды",
      criticalAcknowledgedAt: "Расталған уақыты",
      criticalAcknowledgeAction: "Критикалық қорытындыны растау",
      actionButtons: {
        editReport: "Есепті өңдеу",
        approve: "Растау",
        signOff: "Қол қою",
        saveDraft: "Нобайды сақтау",
        acceptAiDraft: "AI нобайын қабылдау",
        rejectAiDraft: "AI нобайын қабылдамау",
      },
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
    reviewsPage: {
      pageTitle: "Талдауларды тексеру",
      pendingHeading: "Тексеруді күтуде",
      attentionSummary: "талдау сіздің назарыңызды қажет етеді",
      priorityLegend: {
        high: "Жоғары",
        medium: "Орташа",
        low: "Төмен",
      },
      aiConclusion: "AI қорытындысы",
      confidence: "сенімділік",
      details: "Толығырақ",
      comment: "Пікір",
      reject: "Қабылдамау",
      confirm: "Растау",
      ageSuffix: "жаста",
      allReviewedTitle: "Барлық талдаулар тексерілді",
      allReviewedDescription: "Жаңа талдаулар осы жерде автоматты түрде пайда болады",
      timeLabels: {
        twoHoursAgo: "2 сағат бұрын",
        fiveHoursAgo: "5 сағат бұрын",
        yesterday: "Кеше",
      },
      mockCases: {
        brainMriTitle: "Мидың МРТ зерттеуі",
        iotMonitoringTitle: "IoT мониторингі (30 мин)",
        questionnaireTitle: "PSS-10 сауалнамасы",
        brainMriResult: "Атрофияның бастапқы белгілері анықталды",
        iotResult: "Стресс деңгейі жоғарылаған",
        questionnaireResult: "Стрестің орташа деңгейі анықталды",
        brainMriFindings: ["Қыртыстың жеңіл атрофиясы", "Қарыншалардың кеңеюі"],
        iotFindings: ["HRV: 35ms (төмен)", "Стресс: 68%"],
        questionnaireFindings: ["Ұпай: 21/40", "Санат: орташа"],
      },
    },
  },
}

export type { DoctorCopy }

export function getDoctorCopy(localeLike?: string | null): DoctorCopy {
  return doctorCopy[normalizeAppLocale(localeLike)]
}
