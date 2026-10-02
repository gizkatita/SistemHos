(() => {
  const { registerModule, prettyDate, number, rupiah, badge, employeeCell, notify } = window.MedHR;
  registerModule("lembur", {
    title: "Pengelolaan Lembur",
    singular: "Pengajuan Lembur",
    description: "Tinjau pengajuan, durasi, dan nominal lembur karyawan.",
    table: "lembur",
    select: "*,karyawan(nama,nik,unit_kerja)",
    id: "id_lembur",
    order: "tanggal",
    searchPlaceholder: "Cari nama karyawan, NIK, keterangan...",
    searchKeys: ["karyawan.nama", "karyawan.nik", "keterangan"],
    filters: [
      { key: "tanggal", label: "Tanggal", type: "date" },
      { key: "status", label: "Status", options: ["Menunggu", "Disetujui", "Ditolak"] },
      { key: "id_karyawan", label: "Karyawan", source: "employees", get: (row) => row.id_karyawan }
    ],
    actions: [{ name: "approve", label: "Setujui", icon: "check" }, { name: "reject", label: "Tolak", icon: "x" }],
    columns: [
      { label: "Karyawan", render: (row) => employeeCell(row.karyawan) },
      { label: "Tanggal", render: (row) => prettyDate(row.tanggal) },
      { label: "Waktu", render: (row) => `${String(row.jam_mulai).slice(0, 5)} - ${String(row.jam_selesai).slice(0, 5)}` },
      { label: "Total Jam", render: (row) => `${number(row.total_jam, 2)} jam` },
      { label: "Tarif/Jam", render: (row) => rupiah(row.tarif_lembur) },
      { label: "Total Lembur", render: (row) => rupiah(row.total_lembur) },
      { label: "Status", render: (row) => badge(row.status) }
    ],
    fields: [
      { key: "id_karyawan", label: "Karyawan", type: "select", source: "employees", required: true },
      { key: "tanggal", label: "Tanggal Lembur", type: "date", default: () => new Date().toISOString().slice(0, 10), required: true },
      { key: "jam_mulai", label: "Jam Mulai", type: "time", required: true },
      { key: "jam_selesai", label: "Jam Selesai", type: "time", required: true },
      { key: "tarif_lembur", label: "Tarif per Jam (Rp)", type: "number", min: "0", step: "1000", required: true },
      { key: "status", label: "Status", type: "select", options: ["Menunggu", "Disetujui", "Ditolak"], default: "Menunggu", required: true },
      { key: "keterangan", label: "Keterangan", type: "textarea", full: true }
    ],
    handleAction: async (action, row, client) => {
      if (!["approve", "reject"].includes(action) || !row) return;
      const status = action === "approve" ? "Disetujui" : "Ditolak";
      const { error } = await client.from("lembur").update({ status }).eq("id_lembur", row.id_lembur);
      if (error) throw error;
      notify(`Pengajuan lembur ${status.toLowerCase()}.`);
    }
  });
})();
