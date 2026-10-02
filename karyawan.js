(() => {
  const { registerModule, rupiah, prettyDate, badge, employeeCell } = window.MedHR;
  registerModule("karyawan", {
    title: "Data Karyawan",
    singular: "Karyawan",
    description: "Kelola identitas, status kerja, dan informasi kompensasi karyawan.",
    table: "karyawan",
    id: "id_karyawan",
    order: "nama",
    ascending: true,
    searchPlaceholder: "Cari nama, NIK, jabatan...",
    searchKeys: ["nama", "nik", "jabatan", "unit_kerja", "email"],
    filters: [
      { key: "unit_kerja", label: "Unit", source: "units" },
      { key: "status_pegawai", label: "Status Pegawai", options: ["Tetap", "Kontrak", "Honorer"] },
      { key: "status_aktif", label: "Status", options: ["Aktif", "Nonaktif"] }
    ],
    columns: [
      { label: "Karyawan", render: (row) => employeeCell(row) },
      { label: "Jabatan", key: "jabatan" },
      { label: "Unit Kerja", key: "unit_kerja" },
      { label: "Status Pegawai", render: (row) => badge(row.status_pegawai) },
      { label: "Gaji Pokok", render: (row) => rupiah(row.gaji_pokok) },
      { label: "Status", render: (row) => badge(row.status_aktif) },
      { label: "Tanggal Masuk", render: (row) => prettyDate(row.tanggal_masuk) }
    ],
    fields: [
      { key: "nama", label: "Nama Lengkap", required: true, autocomplete: "name" },
      { key: "nik", label: "NIK / Nomor Pegawai", required: true },
      { key: "jabatan", label: "Jabatan", required: true },
      { key: "unit_kerja", label: "Unit Kerja", required: true },
      { key: "status_pegawai", label: "Status Pegawai", type: "select", options: ["Tetap", "Kontrak", "Honorer"], required: true },
      { key: "status_aktif", label: "Status Aktif", type: "select", options: ["Aktif", "Nonaktif"], default: "Aktif", required: true },
      { key: "gaji_pokok", label: "Gaji Pokok (Rp)", type: "number", min: "0", step: "1000", required: true },
      { key: "tanggal_masuk", label: "Tanggal Masuk", type: "date", required: true },
      { key: "no_hp", label: "Nomor HP", type: "tel", autocomplete: "tel" },
      { key: "email", label: "Email", type: "email", autocomplete: "email" }
    ],
    prepare: async (payload) => ({ ...payload, nik: payload.nik?.trim(), nama: payload.nama?.trim(), jabatan: payload.jabatan?.trim(), unit_kerja: payload.unit_kerja?.trim(), no_hp: payload.no_hp?.trim() || null, email: payload.email?.trim() || null })
  });
})();
