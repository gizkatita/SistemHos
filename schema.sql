-- MedHR: five core entities only. Open anon policies are for academic/demo deployment.
-- Never expose a Supabase service-role key in the frontend.
create extension if not exists pgcrypto;

create table if not exists public.karyawan (
  id_karyawan uuid primary key default gen_random_uuid(),
  nik text not null unique,
  nama text not null,
  jabatan text not null,
  unit_kerja text not null,
  status_pegawai text not null check (status_pegawai in ('Tetap', 'Kontrak', 'Honorer')),
  gaji_pokok numeric(14,2) not null default 0 check (gaji_pokok >= 0),
  tanggal_masuk date not null,
  no_hp text,
  email text check (email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'),
  status_aktif text not null default 'Aktif' check (status_aktif in ('Aktif', 'Nonaktif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.absensi (
  id_absensi uuid primary key default gen_random_uuid(),
  id_karyawan uuid not null references public.karyawan(id_karyawan) on delete cascade,
  tanggal date not null,
  jam_masuk time,
  jam_keluar time,
  status_kehadiran text not null check (status_kehadiran in ('Hadir', 'Izin', 'Sakit', 'Cuti', 'Alpa')),
  keterlambatan integer not null default 0 check (keterlambatan >= 0),
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id_karyawan, tanggal)
);

create table if not exists public.lembur (
  id_lembur uuid primary key default gen_random_uuid(),
  id_karyawan uuid not null references public.karyawan(id_karyawan) on delete cascade,
  tanggal date not null,
  jam_mulai time not null,
  jam_selesai time not null,
  total_jam numeric(7,2) not null default 0 check (total_jam >= 0),
  tarif_lembur numeric(14,2) not null default 0 check (tarif_lembur >= 0),
  total_lembur numeric(14,2) not null default 0 check (total_lembur >= 0),
  status text not null default 'Menunggu' check (status in ('Menunggu', 'Disetujui', 'Ditolak')),
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jam_mulai <> jam_selesai)
);

create table if not exists public.penilaian_kinerja (
  id_penilaian uuid primary key default gen_random_uuid(),
  id_karyawan uuid not null references public.karyawan(id_karyawan) on delete cascade,
  periode date not null,
  skor_kehadiran numeric(5,2) not null check (skor_kehadiran between 0 and 100),
  skor_kedisiplinan numeric(5,2) not null check (skor_kedisiplinan between 0 and 100),
  skor_kinerja numeric(5,2) not null check (skor_kinerja between 0 and 100),
  skor_target numeric(5,2) not null check (skor_target between 0 and 100),
  total_skor numeric(5,2) not null default 0 check (total_skor between 0 and 100),
  predikat text not null default 'Sangat Kurang' check (predikat in ('Sangat Baik', 'Baik', 'Cukup', 'Kurang', 'Sangat Kurang')),
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id_karyawan, periode),
  check (periode = date_trunc('month', periode)::date)
);

create table if not exists public.payroll (
  id_payroll uuid primary key default gen_random_uuid(),
  id_karyawan uuid not null references public.karyawan(id_karyawan) on delete cascade,
  periode date not null,
  gaji_pokok numeric(14,2) not null default 0 check (gaji_pokok >= 0),
  total_lembur numeric(14,2) not null default 0 check (total_lembur >= 0),
  tunjangan numeric(14,2) not null default 0 check (tunjangan >= 0),
  insentif numeric(14,2) not null default 0 check (insentif >= 0),
  potongan numeric(14,2) not null default 0 check (potongan >= 0),
  gaji_kotor numeric(14,2) not null default 0 check (gaji_kotor >= 0),
  gaji_bersih numeric(14,2) not null default 0 check (gaji_bersih >= 0),
  status_pembayaran text not null default 'Draft' check (status_pembayaran in ('Draft', 'Diproses', 'Dibayar')),
  tanggal_bayar date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id_karyawan, periode),
  check (periode = date_trunc('month', periode)::date),
  check (potongan <= gaji_pokok + total_lembur + tunjangan + insentif)
);

create index if not exists idx_absensi_tanggal_status on public.absensi (tanggal, status_kehadiran);
create index if not exists idx_absensi_karyawan on public.absensi (id_karyawan);
create index if not exists idx_lembur_tanggal_status on public.lembur (tanggal, status);
create index if not exists idx_lembur_karyawan on public.lembur (id_karyawan);
create index if not exists idx_kinerja_periode on public.penilaian_kinerja (periode, predikat);
create index if not exists idx_payroll_periode_status on public.payroll (periode, status_pembayaran);
create index if not exists idx_payroll_karyawan on public.payroll (id_karyawan);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.calculate_absensi()
returns trigger language plpgsql as $$
begin
  if new.status_kehadiran = 'Hadir' and new.jam_masuk is not null then
    new.keterlambatan := greatest(0, floor(extract(epoch from (new.jam_masuk - time '08:00')) / 60)::integer);
  else
    new.keterlambatan := 0;
  end if;
  return new;
end;
$$;

create or replace function public.calculate_lembur()
returns trigger language plpgsql as $$
declare
  duration_minutes numeric;
begin
  duration_minutes := extract(epoch from (new.jam_selesai - new.jam_mulai)) / 60;
  if duration_minutes <= 0 then duration_minutes := duration_minutes + 1440; end if;
  new.total_jam := round(duration_minutes / 60, 2);
  new.total_lembur := round(new.total_jam * new.tarif_lembur, 2);
  return new;
end;
$$;

create or replace function public.calculate_kinerja()
returns trigger language plpgsql as $$
begin
  new.total_skor := round((new.skor_kehadiran + new.skor_kedisiplinan + new.skor_kinerja + new.skor_target) / 4, 2);
  new.predikat := case
    when new.total_skor >= 90 then 'Sangat Baik'
    when new.total_skor >= 80 then 'Baik'
    when new.total_skor >= 70 then 'Cukup'
    when new.total_skor >= 60 then 'Kurang'
    else 'Sangat Kurang'
  end;
  return new;
end;
$$;

create or replace function public.calculate_payroll()
returns trigger language plpgsql as $$
declare
  employee_salary numeric(14,2);
begin
  select gaji_pokok into employee_salary from public.karyawan where id_karyawan = new.id_karyawan;
  if employee_salary is null then raise exception 'Karyawan tidak ditemukan'; end if;
  new.gaji_pokok := employee_salary;
  select coalesce(sum(total_lembur), 0) into new.total_lembur
  from public.lembur
  where id_karyawan = new.id_karyawan and status = 'Disetujui'
    and tanggal >= date_trunc('month', new.periode)::date
    and tanggal < (date_trunc('month', new.periode) + interval '1 month')::date;
  new.gaji_kotor := new.gaji_pokok + new.total_lembur + new.tunjangan + new.insentif;
  new.gaji_bersih := new.gaji_kotor - new.potongan;
  if new.status_pembayaran = 'Dibayar' and new.tanggal_bayar is null then new.tanggal_bayar := current_date; end if;
  return new;
end;
$$;

create or replace function public.refresh_payroll_overtime()
returns trigger language plpgsql as $$
declare
  employee_id uuid;
  payroll_period date;
begin
  if tg_op <> 'INSERT' then
    employee_id := old.id_karyawan;
    payroll_period := date_trunc('month', old.tanggal)::date;
    if exists (select 1 from public.karyawan where id_karyawan = employee_id) then
      update public.payroll set updated_at = now()
      where id_karyawan = employee_id and periode = payroll_period;
    end if;
  end if;
  if tg_op <> 'DELETE' then
    employee_id := new.id_karyawan;
    payroll_period := date_trunc('month', new.tanggal)::date;
    if exists (select 1 from public.karyawan where id_karyawan = employee_id) then
      update public.payroll set updated_at = now()
      where id_karyawan = employee_id and periode = payroll_period;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_absensi_calculate on public.absensi;
drop trigger if exists trg_lembur_calculate on public.lembur;
drop trigger if exists trg_kinerja_calculate on public.penilaian_kinerja;
drop trigger if exists trg_payroll_calculate on public.payroll;
drop trigger if exists trg_lembur_refresh_payroll on public.lembur;
drop trigger if exists trg_karyawan_updated on public.karyawan;
drop trigger if exists trg_absensi_updated on public.absensi;
drop trigger if exists trg_lembur_updated on public.lembur;
drop trigger if exists trg_kinerja_updated on public.penilaian_kinerja;
drop trigger if exists trg_payroll_updated on public.payroll;
create trigger trg_absensi_calculate before insert or update on public.absensi for each row execute function public.calculate_absensi();
create trigger trg_lembur_calculate before insert or update on public.lembur for each row execute function public.calculate_lembur();
create trigger trg_kinerja_calculate before insert or update on public.penilaian_kinerja for each row execute function public.calculate_kinerja();
create trigger trg_payroll_calculate before insert or update on public.payroll for each row execute function public.calculate_payroll();
create trigger trg_lembur_refresh_payroll after insert or update or delete on public.lembur for each row execute function public.refresh_payroll_overtime();

create trigger trg_karyawan_updated before update on public.karyawan for each row execute function public.set_updated_at();
create trigger trg_absensi_updated before update on public.absensi for each row execute function public.set_updated_at();
create trigger trg_lembur_updated before update on public.lembur for each row execute function public.set_updated_at();
create trigger trg_kinerja_updated before update on public.penilaian_kinerja for each row execute function public.set_updated_at();
create trigger trg_payroll_updated before update on public.payroll for each row execute function public.set_updated_at();

alter table public.karyawan enable row level security;
alter table public.absensi enable row level security;
alter table public.lembur enable row level security;
alter table public.penilaian_kinerja enable row level security;
alter table public.payroll enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['karyawan', 'absensi', 'lembur', 'penilaian_kinerja', 'payroll'] loop
    execute format('drop policy if exists "Academic demo anon full access" on public.%I', table_name);
    execute format('create policy "Academic demo anon full access" on public.%I for all to anon using (true) with check (true)', table_name);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', table_name);
  end loop;
end;
$$;

-- Demo rows: generated for the current month so the first dashboard has live data.
insert into public.karyawan (nik, nama, jabatan, unit_kerja, status_pegawai, gaji_pokok, tanggal_masuk, no_hp, email)
values
('MED-001', 'Gizka Pratama', 'Staff Administrasi', 'Administrasi', 'Tetap', 4500000, '2021-03-15', '081234560001', 'gizka@medhr.demo'),
('MED-002', 'Aditya Saputra', 'Dokter Umum', 'Poli Umum', 'Tetap', 9500000, '2020-06-01', '081234560002', 'aditya@medhr.demo'),
('MED-003', 'Nadia Putri', 'Perawat', 'Rawat Inap', 'Kontrak', 5800000, '2022-01-10', '081234560003', 'nadia@medhr.demo'),
('MED-004', 'Rizky Ramadhan', 'Analis Laboratorium', 'Laboratorium', 'Tetap', 6200000, '2019-11-20', '081234560004', 'rizky@medhr.demo'),
('MED-005', 'Siti Rahmawati', 'Apoteker', 'Farmasi', 'Tetap', 7200000, '2021-08-05', '081234560005', 'siti@medhr.demo'),
('MED-006', 'Bima Mahendra', 'Radiografer', 'Radiologi', 'Kontrak', 6100000, '2023-02-13', '081234560006', 'bima@medhr.demo'),
('MED-007', 'Laras Wulandari', 'Staff Keuangan', 'Keuangan', 'Honorer', 4300000, '2024-04-01', '081234560007', 'laras@medhr.demo'),
('MED-008', 'Dewi Anggraini', 'Perawat', 'IGD', 'Tetap', 6000000, '2018-09-17', '081234560008', 'dewi@medhr.demo'),
('MED-009', 'Fajar Nugroho', 'Petugas Rekam Medis', 'Rekam Medis', 'Kontrak', 4700000, '2022-12-12', '081234560009', 'fajar@medhr.demo'),
('MED-010', 'Maya Kusuma', 'Staff SDM', 'SDM', 'Tetap', 5200000, '2020-02-24', '081234560010', 'maya@medhr.demo')
on conflict (nik) do nothing;

insert into public.absensi (id_karyawan, tanggal, jam_masuk, jam_keluar, status_kehadiran, keterangan)
select k.id_karyawan, current_date - offset_day,
  case when (k.nik = 'MED-003' and offset_day = 0) or (k.nik = 'MED-008' and offset_day = 1) then time '08:17' else time '07:55' end,
  time '17:00',
  case when k.nik = 'MED-006' and offset_day = 0 then 'Izin' else 'Hadir' end,
  case when k.nik = 'MED-006' and offset_day = 0 then 'Keperluan keluarga' else null end
from public.karyawan k cross join generate_series(0, 6) as days(offset_day)
on conflict (id_karyawan, tanggal) do nothing;

insert into public.lembur (id_karyawan, tanggal, jam_mulai, jam_selesai, tarif_lembur, status, keterangan)
select k.id_karyawan, current_date - 2, time '17:00', time '20:00', 50000, 'Disetujui', 'Dukungan operasional'
from public.karyawan k where k.nik in ('MED-001', 'MED-003', 'MED-008')
and not exists (select 1 from public.lembur l where l.id_karyawan = k.id_karyawan and l.tanggal = current_date - 2 and l.keterangan = 'Dukungan operasional');
insert into public.lembur (id_karyawan, tanggal, jam_mulai, jam_selesai, tarif_lembur, status, keterangan)
select k.id_karyawan, current_date, time '17:00', time '19:00', 50000, 'Menunggu', 'Penutupan laporan'
from public.karyawan k where k.nik = 'MED-007'
and not exists (select 1 from public.lembur l where l.id_karyawan = k.id_karyawan and l.tanggal = current_date and l.keterangan = 'Penutupan laporan');

insert into public.penilaian_kinerja (id_karyawan, periode, skor_kehadiran, skor_kedisiplinan, skor_kinerja, skor_target, catatan)
select id_karyawan, date_trunc('month', current_date)::date, 92, 88, 90, 86, 'Evaluasi bulanan'
from public.karyawan where nik in ('MED-001', 'MED-003', 'MED-005', 'MED-008')
on conflict (id_karyawan, periode) do nothing;

insert into public.payroll (id_karyawan, periode, tunjangan, insentif, potongan, status_pembayaran, tanggal_bayar)
select id_karyawan, date_trunc('month', current_date)::date, 750000, 250000, 150000, 'Draft', null
from public.karyawan where nik in ('MED-001', 'MED-002', 'MED-003', 'MED-004', 'MED-005')
on conflict (id_karyawan, periode) do nothing;
