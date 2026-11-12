/* =========================================================
   Room Booking – script.js  (ไม่มีฐานข้อมูล ใช้ localStorage)
   โครงสร้าง: 1.Config/Data  2.Storage  3.Logic  4.UI  5.Events
   ========================================================= */
"use strict";

/* ---------- 1. Config / Data ---------- */
const STORAGE_KEY = "baan-rim-klong:bookings";

const ROOMS = [
  { id: "r1", name: "ห้องสตูดิโอริมคลอง", price: 1500, capacity: 2, color: "#1f6f55", tags: ["เตียงคู่", "ระเบียง", "แอร์"] },
  { id: "r2", name: "ห้องดีลักซ์สวน",     price: 1900, capacity: 2, color: "#14503f", tags: ["เตียงควีน", "วิวสวน", "อ่างอาบน้ำ"] },
  { id: "r3", name: "ห้องแฟมิลี่",         price: 2600, capacity: 4, color: "#2a5d4a", tags: ["2 เตียง", "ห้องนั่งเล่น", "ครัวเล็ก"] },
  { id: "r4", name: "วิลล่าลอยน้ำ",        price: 3400, capacity: 3, color: "#0e7a5c", tags: ["สระส่วนตัว", "เตียงคิง", "อาหารเช้า"] },
  { id: "r5", name: "ห้องไม้สัก",          price: 1700, capacity: 2, color: "#3b6b55", tags: ["ไม้สัก", "ระเบียง", "พัดลม+แอร์"] },
  { id: "r6", name: "ห้องกลุ่มเพื่อน",     price: 3000, capacity: 6, color: "#1a4d3a", tags: ["3 เตียง", "ห้องนั่งเล่น", "กริลล์"] }
];

const state = { search: null, selectedRoom: null }; // search = {checkin, checkout, guests, nights}

/* ---------- 2. Storage ---------- */
const Store = {
  all() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  },
  save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  }
};

/* ---------- 3. Business logic ---------- */
const todayISO = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const nightsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const baht = n => n.toLocaleString("th-TH") + " บาท";

// ช่วงวันชนกันหรือไม่ (วันเช็คเอาต์ของคนแรก = วันเช็คอินของคนถัดไปได้)
const overlaps = (aIn, aOut, bIn, bOut) => aIn < bOut && bIn < aOut;

const isRoomFree = (roomId, checkin, checkout) =>
  !Store.all().some(b => b.roomId === roomId && overlaps(checkin, checkout, b.checkin, b.checkout));

function validateSearch({ checkin, checkout }) {
  if (!checkin || !checkout) return "กรุณาเลือกวันเช็คอินและเช็คเอาต์";
  if (checkin < todayISO()) return "วันเช็คอินต้องไม่เป็นวันที่ผ่านมาแล้ว";
  if (checkout <= checkin) return "วันเช็คเอาต์ต้องหลังวันเช็คอินอย่างน้อย 1 คืน";
  if (nightsBetween(checkin, checkout) > 30) return "จองได้ไม่เกิน 30 คืนต่อครั้ง";
  return "";
}

function validateGuest({ name, phone }) {
  if (name.trim().length < 2) return "กรุณากรอกชื่อผู้จอง";
  if (!/^0\d{8,9}$/.test(phone.replace(/[-\s]/g, ""))) return "เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)";
  return "";
}

function createBooking(room, guest) {
  const { checkin, checkout, guests, nights } = state.search;
  if (!isRoomFree(room.id, checkin, checkout)) return null; // กันจองซ้ำ ณ เวลายืนยัน
  const booking = {
    code: "BRK-" + Date.now().toString(36).toUpperCase().slice(-6),
    roomId: room.id, roomName: room.name, checkin, checkout, guests, nights,
    total: room.price * nights, name: guest.name.trim(), phone: guest.phone.trim()
  };
  const list = Store.all(); list.push(booking);
  return Store.save(list) ? booking : null;
}

function cancelBooking(code) {
  Store.save(Store.all().filter(b => b.code !== code));
}

/* ---------- 4. UI ---------- */
const $ = id => document.getElementById(id);

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 3200);
}

function renderRooms() {
  const s = state.search;
  const list = $("room-list");
  const visible = ROOMS.filter(r => !s || r.capacity >= s.guests);
  $("rooms-summary").textContent = s
    ? `${fmtDate(s.checkin)} – ${fmtDate(s.checkout)} · ${s.nights} คืน · ${s.guests} ท่าน`
    : "เลือกวันพักด้านบนเพื่อตรวจสอบห้องว่าง";

  if (!visible.length) { list.innerHTML = '<p class="empty">ไม่มีห้องที่รองรับจำนวนผู้เข้าพักนี้ ลองลดจำนวนผู้เข้าพักหรือแยกห้อง</p>'; return; }

  list.innerHTML = visible.map(r => {
    const free = s ? isRoomFree(r.id, s.checkin, s.checkout) : true;
    const status = !s ? "" : free
      ? `<span class="status-ok">ว่าง · รวม ${baht(r.price * s.nights)}</span>`
      : `<span class="status-no">ไม่ว่างในช่วงวันที่เลือก</span>`;
    return `<article class="room ${free ? "" : "unavailable"}">
      <div class="room-art" style="background:${r.color}">${r.name}</div>
      <div class="room-body">
        <h3>${r.name}</h3>
        <div class="tags">${r.tags.map(t => `<span>${t}</span>`).join("")}<span>สูงสุด ${r.capacity} ท่าน</span></div>
        <div class="room-foot">
          <div><span class="price">${baht(r.price)} <small>/คืน</small></span><br>${status}</div>
          <button class="btn" data-room="${r.id}" ${s && free ? "" : "disabled"}>${s ? "จองห้องนี้" : "เลือกวันก่อน"}</button>
        </div>
      </div></article>`;
  }).join("");
}

function renderBookings() {
  const list = Store.all().sort((a, b) => a.checkin.localeCompare(b.checkin));
  $("booking-count").textContent = list.length;
  $("booking-list").innerHTML = list.length
    ? list.map(b => `<li>
        <div><span class="code">${b.code}</span> · ${b.roomName}<br>
        ${fmtDate(b.checkin)} – ${fmtDate(b.checkout)} · ${b.nights} คืน · ${b.guests} ท่าน · ${baht(b.total)}<br>
        <small>${esc(b.name)} · ${esc(b.phone)}</small></div>
        <button class="btn ghost" data-cancel="${b.code}">ยกเลิกการจอง</button></li>`).join("")
    : '<li class="empty">ยังไม่มีการจอง เลือกห้องด้านบนเพื่อเริ่มจอง</li>';
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- 5. Events ---------- */
function init() {
  const ci = $("checkin"), co = $("checkout"), gs = $("guests");
  const today = todayISO();
  ci.min = today; ci.value = addDays(today, 1);
  co.min = addDays(today, 1); co.value = addDays(today, 2);
  gs.innerHTML = Array.from({ length: 6 }, (_, i) => `<option value="${i + 1}">${i + 1} ท่าน</option>`).join("");
  gs.value = "2";

  // เลื่อนวันเช็คเอาต์อัตโนมัติเมื่อเปลี่ยนเช็คอิน
  ci.addEventListener("change", () => {
    co.min = addDays(ci.value, 1);
    if (co.value <= ci.value) co.value = addDays(ci.value, 1);
  });

  $("search-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = { checkin: ci.value, checkout: co.value, guests: +gs.value };
    const err = validateSearch(data);
    $("search-error").textContent = err;
    if (err) return;
    state.search = { ...data, nights: nightsBetween(data.checkin, data.checkout) };
    renderRooms();
    $("rooms").scrollIntoView();
  });

  $("room-list").addEventListener("click", e => {
    const btn = e.target.closest("[data-room]"); if (!btn) return;
    const room = ROOMS.find(r => r.id === btn.dataset.room);
    const s = state.search;
    state.selectedRoom = room;
    $("dlg-title").textContent = "จอง" + room.name;
    $("dlg-summary").textContent = `${fmtDate(s.checkin)} – ${fmtDate(s.checkout)} · ${s.nights} คืน · ${s.guests} ท่าน · รวม ${baht(room.price * s.nights)}`;
    $("form-error").textContent = "";
    $("booking-dialog").showModal();
  });

  $("booking-form").addEventListener("submit", e => {
    e.preventDefault();
    const guest = { name: $("f-name").value, phone: $("f-phone").value };
    const err = validateGuest(guest);
    $("form-error").textContent = err;
    if (err) return;
    const booking = createBooking(state.selectedRoom, guest);
    if (!booking) { $("form-error").textContent = "จองไม่สำเร็จ ห้องอาจถูกจองแล้ว ลองค้นหาใหม่"; renderRooms(); return; }
    $("booking-dialog").close();
    e.target.reset();
    renderRooms(); renderBookings();
    toast(`จองสำเร็จ รหัสการจอง ${booking.code}`);
  });

  $("dlg-cancel").addEventListener("click", () => $("booking-dialog").close());

  $("booking-list").addEventListener("click", e => {
    const btn = e.target.closest("[data-cancel]"); if (!btn) return;
    if (!confirm("ยืนยันยกเลิกการจอง " + btn.dataset.cancel + " ?")) return;
    cancelBooking(btn.dataset.cancel);
    renderRooms(); renderBookings();
    toast("ยกเลิกการจองแล้ว");
  });

  renderRooms(); renderBookings();
}

document.addEventListener("DOMContentLoaded", init);
