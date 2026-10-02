(() => {
  const { registerModule, prettyDate, rupiah, badge, employeeCell, notify } = window.MedHR;
  const period = () => new Date().toISOString().slice(0, 7);
  registerModule("payroll", {
    title: "Payroll",
    singular: "Payroll",
    description: "Susun penggajian bulanan dan terbitkan slip gaji karyawan.",
    table: "payroll",
    select: "*,karyawan(nama,nik,jabatan,unit_kerja)",
    id: "id_payroll",
    order: "periode",
    searchPlaceholder: "Cari nama atau NIK karyawan...",
    searchKeys: ["karyawan.nama", "karyawan.nik", "karyawan.unit_kerja"],
    filters: [
      { key: "periode", label: "Periode", type: "month", get: (row) => row.periode },
      { key: "status_pembayaran", label: "Status", options: ["Draft", "Diproses", "Dibayar"] },
      { key: "id_karyawan", label: "Karyawan", source: "employees", get: (row) => row.id_karyawan }
    ],
    actions: [{ name: "slip", label: "Lihat Slip Gaji", icon: "file-text" }, { name: "mark-paid", label: "Tandai Dibayar", icon: "badge-check" }],
    columns: [
      { label: "Periode", render: (row) => prettyDate(row.periode, { month: "long", year: "numeric" }) },
      { label: "Karyawan", render: (row) => employeeCell(row.karyawan) },
      { label: "Gaji Pokok", render: (row) => rupiah(row.gaji_pokok) },
      { label: "Total Lembur", render: (row) => rupiah(row.total_lembur) },
      { label: "Gaji Kotor", render: (row) => rupiah(row.gaji_kotor) },
      { label: "Gaji Bersih", render: (row) => `<strong>${rupiah(row.gaji_bersih)}</strong>` },
      { label: "Status", render: (row) => badge(row.status_pembayaran) }
    ],
    fields: [
      { key: "id_karyawan", label: "Karyawan", type: "select", source: "employees", required: true },
      { key: "periode", label: "Periode Payroll", type: "month", default: period, required: true },
      { key: "tunjangan", label: "Tunjangan (Rp)", type: "number", min: "0", step: "1000", default: 0, required: true },
      { key: "insentif", label: "Insentif (Rp)", type: "number", min: "0", step: "1000", default: 0, required: true },
      { key: "potongan", label: "Potongan (Rp)", type: "number", min: "0", step: "1000", default: 0, required: true },
      { key: "status_pembayaran", label: "Status Pembayaran", type: "select", options: ["Draft", "Diproses", "Dibayar"], default: "Draft", required: true },
      { key: "tanggal_bayar", label: "Tanggal Bayar", type: "date" }
    ],
    formAfter: () => `<div class="field full"><div class="panel" style="padding:12px;background:#f7faf7"><strong style="font-size:10px">Estimasi berdasarkan data tersimpan</strong><div id="payroll-preview" style="font-size:10px;color:#65736c;margin-top:6px">Pilih karyawan untuk menghitung estimasi gaji pokok dan lembur disetujui.</div></div></div>`,
    onFormOpen: async (_row, fields, client) => refreshPreview(fields, client),
    onFormChange: (target, fields, client) => {
      if (["field-id_karyawan", "field-periode", "field-tunjangan", "field-insentif", "field-potongan"].includes(target.id)) refreshPreview(fields, client);
    },
    prepare: async (payload) => {
      if (payload.status_pembayaran === "Dibayar" && !payload.tanggal_bayar) payload.tanggal_bayar = new Date().toISOString().slice(0, 10);
      return payload;
    },
    handleAction: async (action, row, client) => {
      if (action === "slip") { await showPaySlip(row, client); return; }
      if (action === "mark-paid" && row && row.status_pembayaran !== "Dibayar") {
        const { error } = await client.from("payroll").update({ status_pembayaran: "Dibayar", tanggal_bayar: new Date().toISOString().slice(0, 10) }).eq("id_payroll", row.id_payroll);
        if (error) throw error;
        notify("Payroll ditandai sebagai dibayar.");
      }
    }
  });

  async function refreshPreview(fields, client) {
    const target = document.getElementById("payroll-preview");
    const employeeId = fields.querySelector("[name=id_karyawan]")?.value;
    const month = fields.querySelector("[name=periode]")?.value;
    if (!target || !employeeId || !month || !client) {
      if (target) target.textContent = "Pilih karyawan dan periode untuk menghitung estimasi.";
      return;
    }
    const [employeeResult, overtimeResult] = await Promise.all([
      client.from("karyawan").select("gaji_pokok").eq("id_karyawan", employeeId).single(),
      client.from("lembur").select("total_lembur").eq("id_karyawan", employeeId).eq("status", "Disetujui").gte("tanggal", `${month}-01`).lt("tanggal", new Date(new Date(`${month}-01T12:00:00`).setMonth(new Date(`${month}-01T12:00:00`).getMonth() + 1)).toISOString().slice(0, 10))
    ]);
    if (employeeResult.error || overtimeResult.error) { target.textContent = "Estimasi tidak tersedia. Sistem tetap menghitung ulang di database saat disimpan."; return; }
    const base = Number(employeeResult.data.gaji_pokok || 0);
    const overtime = (overtimeResult.data || []).reduce((sum, item) => sum + Number(item.total_lembur || 0), 0);
    const allowance = Number(fields.querySelector("[name=tunjangan]")?.value || 0);
    const incentive = Number(fields.querySelector("[name=insentif]")?.value || 0);
    const deduction = Number(fields.querySelector("[name=potongan]")?.value || 0);
    target.innerHTML = `Gaji pokok ${rupiah(base)} + lembur disetujui ${rupiah(overtime)}<br>Gaji kotor <strong>${rupiah(base + overtime + allowance + incentive)}</strong> · Gaji bersih <strong>${rupiah(base + overtime + allowance + incentive - deduction)}</strong>`;
  }

  async function showPaySlip(row, client) {
    if (!row) return;
    let employee = row.karyawan;
    if (!employee) {
      const result = await client.from("karyawan").select("nama,nik,jabatan,unit_kerja").eq("id_karyawan", row.id_karyawan).single();
      if (result.error) { notify("Data karyawan untuk slip gagal dimuat.", "error"); return; }
      employee = result.data;
    }
    const safe = (value) => String(value ?? "-").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    const income = [["Gaji Pokok", row.gaji_pokok], ["Tunjangan", row.tunjangan], ["Insentif", row.insentif], ["Lembur", row.total_lembur]];
    const html = `<article class="slip"><div class="slip-head"><div class="slip-brand">HOSPITAL HUMAN RESOURCE<small>& PAYROLL MANAGEMENT SYSTEM</small></div><span>MEDHR / FINANCE</span></div><h2>SLIP GAJI</h2><div class="slip-period">Periode ${safe(new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(`${String(row.periode).slice(0, 10)}T12:00:00`)))}</div><div class="slip-identity"><div><span>Nama</span><strong>${safe(employee?.nama)}</strong></div><div><span>NIK</span><strong>${safe(employee?.nik)}</strong></div><div><span>Jabatan</span><strong>${safe(employee?.jabatan)}</strong></div><div><span>Unit Kerja</span><strong>${safe(employee?.unit_kerja)}</strong></div></div><div class="slip-section"><h3>PENDAPATAN</h3>${income.map(([label, amount]) => `<div class="slip-line"><span>${label}</span><strong>${rupiah(amount)}</strong></div>`).join("")}<div class="slip-line"><span>Gaji Kotor</span><strong>${rupiah(row.gaji_kotor)}</strong></div></div><div class="slip-section"><h3>POTONGAN</h3><div class="slip-line"><span>Potongan</span><strong>${rupiah(row.potongan)}</strong></div></div><div class="slip-total"><span>GAJI BERSIH</span><span>${rupiah(row.gaji_bersih)}</span></div><div class="slip-section"><div class="slip-line"><span>Status Pembayaran</span><strong>${safe(row.status_pembayaran)}</strong></div><div class="slip-line"><span>Tanggal Pembayaran</span><strong>${safe(row.tanggal_bayar ? prettyDate(row.tanggal_bayar) : "Belum dibayar")}</strong></div></div></article>`;
    window.MedHR.showSlip(html);
  }
})();
