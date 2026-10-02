(() => {
  const { registerModule, prettyDate, badge, employeeCell } = window.MedHR;
  registerModule("absensi", {
    title: "Absensi",
    singular: "Absensi",
    description: "Catat kehadiran harian dan pantau keterlambatan karyawan.",
    table: "absensi",
    select: "*,karyawan(nama,nik,unit_kerja)",
    id: "id_absensi",
    order: "tanggal",
    searchPlaceholder: "Cari nama karyawan, NIK, keterangan...",
    searchKeys: ["karyawan.nama", "karyawan.nik", "keterangan", "status_kehadiran"],
    filters: [
      { key: "tanggal", label: "Tanggal", type: "date" },
      { key: "status_kehadiran", label: "Status", options: ["Hadir", "Izin", "Sakit", "Cuti", "Alpa"] },
      { key: "id_karyawan", label: "Karyawan", source: "employees", get: (row) => row.id_karyawan }
    ],
    columns: [
      { label: "Tanggal", render: (row) => prettyDate(row.tanggal) },
      { label: "Karyawan", render: (row) => employeeCell(row.karyawan) },
      { label: "Jam Masuk", render: (row) => row.jam_masuk ? String(row.jam_masuk).slice(0, 5) : "-" },
      { label: "Jam Keluar", render: (row) => row.jam_keluar ? String(row.jam_keluar).slice(0, 5) : "-" },
      { label: "Status", render: (row) => badge(row.status_kehadiran) },
      { label: "Terlambat", render: (row) => `${row.keterlambatan || 0} menit` },
      { label: "Keterangan", key: "keterangan" }
    ],
    fields: [
      { key: "id_karyawan", label: "Karyawan", type: "select", source: "employees", required: true },
      { key: "tanggal", label: "Tanggal", type: "date", default: () => new Date().toISOString().slice(0, 10), required: true },
      { key: "jam_masuk", label: "Jam Masuk", type: "time", hint: "Keterlambatan dihitung otomatis setelah pukul 08.00." },
      { key: "jam_keluar", label: "Jam Keluar", type: "time" },
      { key: "status_kehadiran", label: "Status Kehadiran", type: "select", options: ["Hadir", "Izin", "Sakit", "Cuti", "Alpa"], default: "Hadir", required: true },
      { key: "keterangan", label: "Keterangan", type: "textarea", full: true }
    ]
  });
})();
