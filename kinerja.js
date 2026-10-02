(() => {
  const { registerModule, prettyDate, number, badge, employeeCell } = window.MedHR;
  registerModule("kinerja", {
    title: "Penilaian Kinerja",
    singular: "Penilaian Kinerja",
    description: "Kelola evaluasi berkala dengan skor dan predikat otomatis.",
    table: "penilaian_kinerja",
    select: "*,karyawan(nama,nik,unit_kerja)",
    id: "id_penilaian",
    order: "periode",
    searchPlaceholder: "Cari karyawan atau catatan...",
    searchKeys: ["karyawan.nama", "karyawan.nik", "catatan", "predikat"],
    filters: [
      { key: "periode", label: "Periode", type: "month", get: (row) => row.periode },
      { key: "predikat", label: "Predikat", options: ["Sangat Baik", "Baik", "Cukup", "Kurang", "Sangat Kurang"] },
      { key: "id_karyawan", label: "Karyawan", source: "employees", get: (row) => row.id_karyawan }
    ],
    columns: [
      { label: "Periode", render: (row) => prettyDate(row.periode, { month: "long", year: "numeric" }) },
      { label: "Karyawan", render: (row) => employeeCell(row.karyawan) },
      { label: "Kehadiran", render: (row) => number(row.skor_kehadiran, 1) },
      { label: "Kedisiplinan", render: (row) => number(row.skor_kedisiplinan, 1) },
      { label: "Kinerja", render: (row) => number(row.skor_kinerja, 1) },
      { label: "Target", render: (row) => number(row.skor_target, 1) },
      { label: "Total Skor", render: (row) => `<strong>${number(row.total_skor, 2)}</strong>` },
      { label: "Predikat", render: (row) => badge(row.predikat) }
    ],
    fields: [
      { key: "id_karyawan", label: "Karyawan", type: "select", source: "employees", required: true },
      { key: "periode", label: "Periode Penilaian", type: "month", default: () => new Date().toISOString().slice(0, 7), required: true },
      { key: "skor_kehadiran", label: "Skor Kehadiran", type: "number", min: "0", max: "100", step: ".01", required: true },
      { key: "skor_kedisiplinan", label: "Skor Kedisiplinan", type: "number", min: "0", max: "100", step: ".01", required: true },
      { key: "skor_kinerja", label: "Skor Kinerja", type: "number", min: "0", max: "100", step: ".01", required: true },
      { key: "skor_target", label: "Skor Target", type: "number", min: "0", max: "100", step: ".01", required: true },
      { key: "catatan", label: "Catatan Evaluasi", type: "textarea", full: true }
    ]
  });
})();
