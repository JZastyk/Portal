/* ===== Встроенная начальная история смен за сентябрь 2026 г. ===== */
/* Содержит полные зафиксированные данные по сменам: машины, операторы, замеры рукавов и расход химии */

const INITIAL_REPORTS_HISTORY = [
  {
    id: "2026-09-01",
    date: "2026-09-01",
    shiftDate: "2026-09-01",
    author: "Калабухов",
    time: "2026-09-02T05:00:00.000Z",
    text: "01.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 01.09.2026:\n1 бокс - 0\n2 бокс - 5\n3 бокс - 13\n\nПроход рукава 3 бокс:\nСлева - 0.358\nСзади - 0.652\nСправа - 0.385",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "5", "13"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.358", back: "0.652", right: "0.385" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-02",
    date: "2026-09-02",
    shiftDate: "2026-09-02",
    author: "Трофименко",
    time: "2026-09-03T05:00:00.000Z",
    text: "02.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 02.09.2026:\n1 бокс - 0\n2 бокс - 3\n3 бокс - 8\n\nПроход рукава 3 бокс:\nСлева - 0.361\nСзади - 0.774\nСправа - 0.361",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "3", "8"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.361", back: "0.774", right: "0.361" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-03",
    date: "2026-09-03",
    shiftDate: "2026-09-03",
    author: "Трофименко",
    time: "2026-09-04T05:00:00.000Z",
    text: "03.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 03.09.2026:\n1 бокс - 0\n2 бокс - 3\n3 бокс - 20\n\nПроход рукава 3 бокс:\nСлева - 0.364\nСзади - 0.789\nСправа - 0.372",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "3", "20"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.364", back: "0.789", right: "0.372" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-04",
    date: "2026-09-04",
    shiftDate: "2026-09-04",
    author: "Калабухов",
    time: "2026-09-05T05:00:00.000Z",
    text: "04.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 04.09.2026:\n1 бокс - 1\n2 бокс - 2\n3 бокс - 15\n\nПроход рукава 3 бокс:\nСлева - 0.354\nСзади - 0.690\nСправа - 0.382",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "1", "2", "15"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.354", back: "0.690", right: "0.382" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-05",
    date: "2026-09-05",
    shiftDate: "2026-09-05",
    author: "Калабухов",
    time: "2026-09-06T05:00:00.000Z",
    text: "05.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 05.09.2026:\n1 бокс - 0\n2 бокс - 10\n3 бокс - 10\n\nПроход рукава 3 бокс:\nСлева - 0.379\nСзади - 0.774\nСправа - 0.431",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "10", "10"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.379", back: "0.774", right: "0.431" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-06",
    date: "2026-09-06",
    shiftDate: "2026-09-06",
    author: "Трофименко",
    time: "2026-09-07T05:00:00.000Z",
    text: "06.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 06.09.2026:\n1 бокс - 0\n2 бокс - 0\n3 бокс - 7",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "0", "7"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-07",
    date: "2026-09-07",
    shiftDate: "2026-09-07",
    author: "Трофименко",
    time: "2026-09-08T05:00:00.000Z",
    text: "07.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 07.09.2026:\n1 бокс - 0\n2 бокс - 2\n3 бокс - 10",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "2", "10"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-08",
    date: "2026-09-08",
    shiftDate: "2026-09-08",
    author: "Калабухов",
    time: "2026-09-09T05:00:00.000Z",
    text: "08.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 08.09.2026:\n1 бокс - 1\n2 бокс - 4\n3 бокс - 9",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "1", "4", "9"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-09",
    date: "2026-09-09",
    shiftDate: "2026-09-09",
    author: "Калабухов",
    time: "2026-09-10T05:00:00.000Z",
    text: "09.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 09.09.2026:\n1 бокс - 0\n2 бокс - 2\n3 бокс - 8",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "2", "8"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-10",
    date: "2026-09-10",
    shiftDate: "2026-09-10",
    author: "Трофименко",
    time: "2026-09-11T05:00:00.000Z",
    text: "10.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 10.09.2026:\n1 бокс - 2\n2 бокс - 7\n3 бокс - 12\n\nПроход рукава 3 бокс:\nСлева - 0.357\nСзади - 0.728\nСправа - 0.395",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "2", "7", "12"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.357", back: "0.728", right: "0.395" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-11",
    date: "2026-09-11",
    shiftDate: "2026-09-11",
    author: "Трофименко",
    time: "2026-09-12T05:00:00.000Z",
    text: "11.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 11.09.2026:\n1 бокс - 0\n2 бокс - 2\n3 бокс - 16\n\nПроход рукава 2 бокс:\nСлева - 0.388\nСзади - 0.721\nСправа - 0.394\n\nПроход рукава 3 бокс:\nСлева - 0.397\nСзади - 0.748\nСправа - 0.402",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "2", "16"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "0.388", back: "0.721", right: "0.394" },
        { left: "0.397", back: "0.748", right: "0.402" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-12",
    date: "2026-09-12",
    shiftDate: "2026-09-12",
    author: "Калабухов",
    time: "2026-09-13T05:00:00.000Z",
    text: "12.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 12.09.2026:\n1 бокс - 1\n2 бокс - 6\n3 бокс - 17\n\nПроход рукава 3 бокс:\nСлева - 0.381\nСзади - 0.729\nСправа - 0.397",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "1", "6", "17"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.381", back: "0.729", right: "0.397" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-13",
    date: "2026-09-13",
    shiftDate: "2026-09-13",
    author: "Калабухов",
    time: "2026-09-14T05:00:00.000Z",
    text: "13.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 13.09.2026:\n1 бокс - 4\n2 бокс - 6\n3 бокс - 17\n\nПроход рукава 3 бокс:\nСлева - 0.357\nСзади - 0.749\nСправа - 0.395",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "4", "6", "17"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.357", back: "0.749", right: "0.395" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-14",
    date: "2026-09-14",
    shiftDate: "2026-09-14",
    author: "Трофименко",
    time: "2026-09-15T05:00:00.000Z",
    text: "14.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 14.09.2026:\n1 бокс - 0\n2 бокс - 0\n3 бокс - 3\n\nПроход рукава 3 бокс:\nСлева - 0.423\nСзади - 0.700\nСправа - 0.394",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "0", "3"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.423", back: "0.700", right: "0.394" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-15",
    date: "2026-09-15",
    shiftDate: "2026-09-15",
    author: "Трофименко",
    time: "2026-09-16T05:00:00.000Z",
    text: "15.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 15.09.2026:\n1 бокс - 1\n2 бокс - 0\n3 бокс - 7\n\nПроход рукава 3 бокс:\nСлева - 0.367\nСзади - 0.779\nСправа - 0.370",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "1", "0", "7"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.367", back: "0.779", right: "0.370" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-16",
    date: "2026-09-16",
    shiftDate: "2026-09-16",
    author: "Калабухов",
    time: "2026-09-17T05:00:00.000Z",
    text: "16.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 16.09.2026:\n1 бокс - 0\n2 бокс - 1\n3 бокс - 6\n\nПроход рукава 3 бокс:\nСлева - 0.398\nСзади - 0.772\nСправа - 0.408\n\nРасход химии 3 бокс:\nПена жёлтая - 14 г.\nПена розовая - 13 г.\nПена голубая - 14 г.\nЭмульсия - 140 г.",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "1", "6"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.398", back: "0.772", right: "0.408" }
      ],
      consumption: {
        "3": {
          "Пена жёлтая": "14",
          "Пена розовая": "13",
          "Пена голубая": "14",
          "Эмульсия": "140"
        }
      }
    }
  },
  {
    id: "2026-09-17",
    date: "2026-09-17",
    shiftDate: "2026-09-17",
    author: "Калабухов",
    time: "2026-09-18T05:00:00.000Z",
    text: "17.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 17.09.2026:\n1 бокс - 0\n2 бокс - 3\n3 бокс - 8\n\nПроход рукава 3 бокс:\nСлева - 0.363\nСзади - 0.660\nСправа - 0.407\n\nРасход химии 3 бокс:\nПена жёлтая - 13 г.\nПена розовая - 14 г.\nПена голубая - 14 г.\nЭмульсия - 136 г.",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "3", "8"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.363", back: "0.660", right: "0.407" }
      ],
      consumption: {
        "3": {
          "Пена жёлтая": "13",
          "Пена розовая": "14",
          "Пена голубая": "14",
          "Эмульсия": "136"
        }
      }
    }
  },
  {
    id: "2026-09-18",
    date: "2026-09-18",
    shiftDate: "2026-09-18",
    author: "Трофименко",
    time: "2026-09-19T05:00:00.000Z",
    text: "18.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 18.09.2026:\n1 бокс - 3\n2 бокс - 5\n3 бокс - 13\n\nПроход рукава 2 бокс:\nСлева - 0.352\nСзади - 0.699\nСправа - 0.394\n\nРасход химии 3 бокс:\nПена жёлтая - 13 г.\nПена розовая - 14 г.\nПена голубая - 13 г.\nЭмульсия - 134 г.",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "3", "5", "13"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "0.352", back: "0.699", right: "0.394" },
        { left: "", back: "", right: "" }
      ],
      consumption: {
        "3": {
          "Пена жёлтая": "13",
          "Пена розовая": "14",
          "Пена голубая": "13",
          "Эмульсия": "134"
        }
      }
    }
  },
  {
    id: "2026-09-19",
    date: "2026-09-19",
    shiftDate: "2026-09-19",
    author: "Трофименко",
    time: "2026-09-20T05:00:00.000Z",
    text: "19.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 19.09.2026:\n1 бокс - 2\n2 бокс - 4\n3 бокс - 13\n\nПроход рукава 2 бокс:\nСлева - 0.341\nСзади - 0.669\nСправа - 0.370\n\nПроход рукава 3 бокс:\nСлева - 0.388\nСзади - 0.701\nСправа - 0.364",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "2", "4", "13"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "0.341", back: "0.669", right: "0.370" },
        { left: "0.388", back: "0.701", right: "0.364" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-20",
    date: "2026-09-20",
    shiftDate: "2026-09-20",
    author: "Калабухов",
    time: "2026-09-21T05:00:00.000Z",
    text: "20.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 20.09.2026:\n1 бокс - 1\n2 бокс - 5\n3 бокс - 19\n\nПроход рукава 3 бокс:\nСлева - 0.393\nСзади - 0.950\nСправа - 0.404\n\nРасход химии 3 бокс:\nПена жёлтая - 14 г.\nПена розовая - 13 г.\nПена голубая - 13 г.\nЭмульсия - 135 г.",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "1", "5", "19"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.393", back: "0.950", right: "0.404" }
      ],
      consumption: {
        "3": {
          "Пена жёлтая": "14",
          "Пена розовая": "13",
          "Пена голубая": "13",
          "Эмульсия": "135"
        }
      }
    }
  },
  {
    id: "2026-09-21",
    date: "2026-09-21",
    shiftDate: "2026-09-21",
    author: "Калабухов",
    time: "2026-09-22T05:00:00.000Z",
    text: "21.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 21.09.2026:\n1 бокс - 0\n2 бокс - 1\n3 бокс - 8",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "1", "8"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-22",
    date: "2026-09-22",
    shiftDate: "2026-09-22",
    author: "Трофименко",
    time: "2026-09-23T05:00:00.000Z",
    text: "22.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 22.09.2026:\n1 бокс - 0\n2 бокс - 1\n3 бокс - 7\n\nПроход рукава 3 бокс:\nСлева - 0.354\nСзади - 0.690\nСправа - 0.377",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "1", "7"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.354", back: "0.690", right: "0.377" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-23",
    date: "2026-09-23",
    shiftDate: "2026-09-23",
    author: "Трофименко",
    time: "2026-09-24T05:00:00.000Z",
    text: "23.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 23.09.2026:\n1 бокс - 0\n2 бокс - 2\n3 бокс - 4",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "2", "4"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" }
      ],
      consumption: {}
    }
  },
  {
    id: "2026-09-24",
    date: "2026-09-24",
    shiftDate: "2026-09-24",
    author: "Калабухов",
    time: "2026-09-25T05:00:00.000Z",
    text: "24.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 24.09.2026:\n1 бокс - 0\n2 бокс - 1\n3 бокс - 3\n\nРасход химии 3 бокс:\nПена жёлтая - 15 г.\nПена розовая - 14 г.\nПена голубая - 14 г.\nЭмульсия - 138 г.",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "",
      washed: [null, "0", "1", "3"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" }
      ],
      consumption: {
        "3": {
          "Пена жёлтая": "15",
          "Пена розовая": "14",
          "Пена голубая": "14",
          "Эмульсия": "138"
        }
      }
    }
  },
  {
    id: "2026-09-25",
    date: "2026-09-25",
    shiftDate: "2026-09-25",
    author: "Калабухов",
    time: "2026-09-26T15:58:51.656Z",
    text: "25.09.2026 Калабухов\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 25.09.2026:\n1 бокс - 1\n2 бокс - 3\n3 бокс - 15\n\nTDS - 18\n\nПроход рукава 3 бокс:\nСлева - 0.396\nСзади - 0.855\nСправа - 0.405\n\nРасход химии 3 бокс:\nПена жёлтая - 14 г.\nПена розовая - 14 г.\nПена голубая - 15 г.\nГидрофоб - 10 г.\nЭмульсия - 135 г.",
    report: {
      author: "Калабухов",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "18",
      washed: [null, "1", "3", "15"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "0.396", back: "0.855", right: "0.405" }
      ],
      consumption: {
        "3": {
          "Пена жёлтая": "14",
          "Пена розовая": "14",
          "Пена голубая": "15",
          "Гидрофоб": "10",
          "Эмульсия": "135"
        }
      }
    }
  },
  {
    id: "2026-09-26",
    date: "2026-09-26",
    shiftDate: "2026-09-26",
    author: "Трофименко",
    time: "2026-09-27T07:53:53.732Z",
    text: "26.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 26.09.2026:\n1 бокс - 0\n2 бокс - 3\n3 бокс - 15\n\nTDS - 18\n\nПроход рукава 2 бокс:\nСлева - 0.355\nСзади - 0.701\nСправа - 0.384\n\nПроход рукава 3 бокс:\nСлева - 0.366\nСзади - 0.788\nСправа - 0.350\n\nРасход химии 3 бокс:\nПена розовая - 14 г.\nПена голубая - 13 г.\nЭмульсия - 135 г.",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", "75"],
      tds: "18",
      washed: [null, "0", "3", "15"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "0.355", back: "0.701", right: "0.384" },
        { left: "0.366", back: "0.788", right: "0.350" }
      ],
      consumption: {
        "3": {
          "Пена розовая": "14",
          "Пена голубая": "13",
          "Эмульсия": "135"
        }
      }
    }
  },
  {
    id: "2026-09-27",
    date: "2026-09-27",
    shiftDate: "2026-09-27",
    author: "Трофименко",
    time: "2026-09-28T05:00:00.000Z",
    text: "27.09.2026 Трофименко\nБоксы 1, 2, 3 - работают в штатном режиме.\n\nПомыто машин за 27.09.2026:\n1 бокс - 0\n2 бокс - 3\n3 бокс - 20\n\nTDS - 18",
    report: {
      author: "Трофименко",
      boxState: [null, "ok", "ok", "ok"],
      compressorState: [null, "ok", "ok"],
      pumpState: [null, "ok", "ok", "ok"],
      pumpPressure: [null, "", "", ""],
      tds: "18",
      washed: [null, "0", "3", "20"],
      hoses: [
        null,
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" },
        { left: "", back: "", right: "" }
      ],
      consumption: {}
    }
  }
];

/**
 * Возвращает эталонные записи истории за сентябрь
 */
function getSeedReportsHistory(){
  return JSON.parse(JSON.stringify(INITIAL_REPORTS_HISTORY));
}
