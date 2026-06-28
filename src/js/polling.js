import {
  onAuthStateChangedListener,
  signOutUser,
  signInWithGoogle,
} from "./auth.js";
import {
  getSystemConfig,
  getAllProposals,
  checkHasVoted,
  castVote,
} from "./db.js";

// Global Polling State
let currentUser = null;
let selectedPelajarId = null;
let selectedUmumId = null;

// DOM Elements
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");
const toastContainer = document.getElementById("toast-container");
const btnAuthAction = document.getElementById("btn-auth-action");
const navUserEmail = document.getElementById("nav-user-email");
const btnThemeToggle = document.getElementById("btn-theme-toggle");

const activeContainer = document.getElementById("polling-active-container");
const inactiveContainer = document.getElementById("polling-inactive-container");
const votedContainer = document.getElementById("polling-voted-container");

const pelajarList = document.getElementById("polling-pelajar-list");
const umumList = document.getElementById("polling-umum-list");
const formSubmitPoll = document.getElementById("form-submit-poll");
const pollScheduleRangeText = document.getElementById("poll-schedule-range-text");
const btnResetLocal = document.getElementById("btn-poll-reset-local");
const pollAuthFields = document.getElementById("poll-auth-fields");
const pollUnauthFields = document.getElementById("poll-unauth-fields");
const btnPollLoginGoogle = document.getElementById("btn-poll-login-google");

// Initialize Lucide Icons
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// UI Loading indicators
function showLoading(text = "Memproses data...") {
  if (loadingText) loadingText.textContent = text;
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.add("hidden");
}

// UI Notification Toasts
function showToast(message, type = "info") {
  if (!toastContainer) return;
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let iconName = "info";
  if (type === "success") iconName = "check-circle";
  if (type === "error") iconName = "x-circle";
  if (type === "warning") iconName = "alert-triangle";

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-5 h-5"></i>
    <span class="text-sm font-medium flex-grow">${message}</span>
    <button type="button" class="text-slate-500 hover:text-white transition-colors" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  toastContainer.appendChild(toast);
  refreshIcons();

  // Slide in
  setTimeout(() => toast.classList.add("show"), 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Translate database error messages
function formatDbError(error) {
  return error.message || "Gagal memproses data di database.";
}

// Theme Toggle initialization
const savedTheme = localStorage.getItem("krenova_theme") || "dark";
if (savedTheme === "light") {
  document.documentElement.classList.remove("dark");
  document.documentElement.classList.add("light");
} else {
  document.documentElement.classList.remove("light");
  document.documentElement.classList.add("dark");
}

if (btnThemeToggle) {
  btnThemeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("krenova_theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      localStorage.setItem("krenova_theme", "dark");
    }
  });
}



// Listen for Authentication Changes to sync state
onAuthStateChangedListener(async (user) => {
  currentUser = user;

  if (user) {
    if (navUserEmail) {
      navUserEmail.textContent = user.email;
      navUserEmail.classList.remove("hidden");
    }
    if (btnAuthAction) {
      btnAuthAction.innerHTML = `<i data-lucide="log-out" class="w-4 h-4"></i><span>Keluar Portal</span>`;
    }
  } else {
    if (navUserEmail) {
      navUserEmail.textContent = "";
      navUserEmail.classList.add("hidden");
    }
    if (btnAuthAction) {
      btnAuthAction.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Login</span>`;
    }
  }

  // Trigger update to public polling view based on schedule and auth state
  await loadScheduleConfig();
  refreshIcons();
});

// Update Polling UI state
async function updatePollingView(schedule) {
  if (!activeContainer || !inactiveContainer || !votedContainer) return;

  activeContainer.classList.add("hidden");
  inactiveContainer.classList.add("hidden");
  votedContainer.classList.add("hidden");

  const now = new Date();
  const pollActive = schedule.poll_active || false;
  const pollStart = schedule.poll_start ? new Date(schedule.poll_start) : null;
  const pollEnd = schedule.poll_end ? new Date(schedule.poll_end) : null;

  const isPollPeriod = pollActive && pollStart && pollEnd && now >= pollStart && now <= pollEnd;

  if (!isPollPeriod) {
    inactiveContainer.classList.remove("hidden");
    return;
  }

  let hasVoted = false;
  if (localStorage.getItem("krenova_has_voted_locally") === "true") {
    hasVoted = true;
  }

  if (currentUser && currentUser.email) {
    try {
      const serverVoted = await checkHasVoted(currentUser.email);
      if (serverVoted) {
        hasVoted = true;
        localStorage.setItem("krenova_has_voted_locally", "true");
      }
    } catch (e) {
      console.warn("Gagal mengecek status vote di server:", e);
    }
  }

  if (hasVoted) {
    votedContainer.classList.remove("hidden");
  } else {
    activeContainer.classList.remove("hidden");
    await renderPollingItems();
  }
}

// Fetch and render approved proposals to be voted
async function renderPollingItems() {
  if (!pelajarList || !umumList) return;

  pelajarList.innerHTML = `<div class="p-4 text-center text-slate-400">Memuat...</div>`;
  umumList.innerHTML = `<div class="p-4 text-center text-slate-400">Memuat...</div>`;

  try {
    const proposals = await getAllProposals("juri"); // approved proposals only
    
    const pelajarProps = proposals.filter(p => (p.kategoriPengusul || "Pelajar").trim().toLowerCase() === "pelajar");
    const umumProps = proposals.filter(p => (p.kategoriPengusul || "Pelajar").trim().toLowerCase() === "umum");

    // Render Pelajar Kategori
    if (pelajarProps.length === 0) {
      pelajarList.innerHTML = `<div class="p-8 text-center text-slate-500 bg-white/5 rounded-2xl border border-white/5">Belum ada proposal pelajar yang disetujui untuk dipolling.</div>`;
    } else {
      pelajarList.innerHTML = "";
      pelajarProps.forEach(p => {
        pelajarList.appendChild(createPollCard(p, "pelajar"));
      });
    }

    // Render Umum Kategori
    if (umumProps.length === 0) {
      umumList.innerHTML = `<div class="p-8 text-center text-slate-500 bg-white/5 rounded-2xl border border-white/5">Belum ada proposal umum yang disetujui untuk dipolling.</div>`;
    } else {
      umumList.innerHTML = "";
      umumProps.forEach(p => {
        umumList.appendChild(createPollCard(p, "umum"));
      });
    }
    
    // Toggle auth/unauth fields inside submit box
    if (currentUser && currentUser.email) {
      if (pollAuthFields) pollAuthFields.classList.remove("hidden");
      if (pollUnauthFields) pollUnauthFields.classList.add("hidden");

      const emailInput = document.getElementById("poll-user-email");
      if (emailInput) {
        emailInput.value = currentUser.email;
        emailInput.disabled = true;
        emailInput.classList.add("bg-slate-800/50", "cursor-not-allowed");
      }
    } else {
      if (pollAuthFields) pollAuthFields.classList.add("hidden");
      if (pollUnauthFields) pollUnauthFields.classList.remove("hidden");
    }
  } catch (e) {
    console.error("Gagal memuat proposal polling:", e);
    pelajarList.innerHTML = `<div class="p-4 text-center text-rose-400">Gagal memuat data.</div>`;
    umumList.innerHTML = `<div class="p-4 text-center text-rose-400">Gagal memuat data.</div>`;
  }
  refreshIcons();
}

// Generate Card elements for public voting view
function createPollCard(prop, categoryType) {
  const card = document.createElement("div");
  const isSelected = (categoryType === "pelajar" && selectedPelajarId === prop.id) ||
                     (categoryType === "umum" && selectedUmumId === prop.id);

  card.className = isSelected 
    ? (categoryType === "pelajar" 
        ? "glass-card rounded-2xl p-5 border border-indigo-500/50 bg-indigo-500/5 shadow-lg shadow-indigo-500/5 cursor-pointer flex flex-col justify-between transition-all relative overflow-hidden group"
        : "glass-card rounded-2xl p-5 border border-cyan-500/50 bg-cyan-500/5 shadow-lg shadow-cyan-500/5 cursor-pointer flex flex-col justify-between transition-all relative overflow-hidden group")
    : "glass-card rounded-2xl p-5 border border-white/5 hover:border-white/10 cursor-pointer flex flex-col justify-between transition-all relative overflow-hidden group";
  card.setAttribute("data-id", prop.id);
  
  const indicatorClass = isSelected
    ? (categoryType === "pelajar"
        ? "poll-select-indicator w-5 h-5 rounded-full bg-indigo-500 border-indigo-500 flex items-center justify-center text-white transition-all"
        : "poll-select-indicator w-5 h-5 rounded-full bg-cyan-500 border-cyan-500 flex items-center justify-center text-white transition-all")
    : "poll-select-indicator w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-transparent transition-all group-hover:border-indigo-400";

  card.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-start gap-2">
        <span class="text-xs text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">${prop.bidang || prop.category || "Inovasi"}</span>
        <div class="${indicatorClass}">
          <i data-lucide="check" class="w-3.5 h-3.5"></i>
        </div>
      </div>
      <h4 class="font-display font-bold text-slate-100 text-sm line-clamp-2 group-hover:text-indigo-400 transition-colors">${prop.title || prop.judul_inovasi}</h4>
      <p class="text-xs text-slate-400 font-medium">${prop.fullName || prop.nama_inovator || "Inovator"}</p>
      <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">${prop.description || prop.abstrak || ""}</p>
    </div>
  `;

  card.addEventListener("click", async () => {
    if (!currentUser) {
      showLoading("Menghubungkan ke Google Account...");
      try {
        const user = await signInWithGoogle();
        currentUser = user;
        showToast(`Selamat datang, ${user.fullName || user.email}!`, "success");
        
        // Auto-select the clicked card
        if (categoryType === "pelajar") {
          selectedPelajarId = prop.id;
        } else {
          selectedUmumId = prop.id;
        }
        
        // Sync schedule & refresh the items
        await loadScheduleConfig();
      } catch (error) {
        console.error("Login Gagal:", error);
        showToast(error.message || "Gagal masuk dengan Google Account.", "error");
      } finally {
        hideLoading();
      }
      return;
    }

    // Toggle selection if already authenticated
    if (categoryType === "pelajar") {
      if (selectedPelajarId === prop.id) {
        selectedPelajarId = null;
      } else {
        selectedPelajarId = prop.id;
      }
    } else {
      if (selectedUmumId === prop.id) {
        selectedUmumId = null;
      } else {
        selectedUmumId = prop.id;
      }
    }
    
    await renderPollingItems();
  });

  return card;
}

// Load schedule config initially
async function loadScheduleConfig() {
  try {
    const schedule = await getSystemConfig("schedule");
    if (schedule) {
      const formatScheduleDate = (isoStr) => {
        if (!isoStr) return "-";
        const date = new Date(isoStr);
        return (
          date.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }) + " WIB"
        );
      };

      if (pollScheduleRangeText) {
        pollScheduleRangeText.textContent = `${formatScheduleDate(schedule.poll_start)} s/d ${formatScheduleDate(schedule.poll_end)}`;
      }

      await updatePollingView(schedule);
    }
  } catch (e) {
    console.error("Gagal memuat konfigurasi jadwal:", e);
  }
}

// Event Listeners for forms
if (formSubmitPoll) {
  formSubmitPoll.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUser) {
      showToast("Anda harus login menggunakan akun Google terlebih dahulu!", "warning");
      return;
    }
    
    if (!selectedPelajarId && !selectedUmumId) {
      showToast("Silakan pilih setidaknya satu proposal favorit Anda!", "warning");
      return;
    }

    const emailInput = document.getElementById("poll-user-email");
    if (!emailInput) return;
    const email = emailInput.value.trim();

    if (!email) {
      showToast("Masukkan alamat email Anda!", "warning");
      return;
    }

    showLoading("Mengirim pilihan polling suara Anda...");
    try {
      await castVote(email, selectedPelajarId, selectedUmumId);
      showToast("Dukungan suara polling Anda berhasil dikirim!", "success");
      
      localStorage.setItem("krenova_has_voted_locally", "true");
      selectedPelajarId = null;
      selectedUmumId = null;
      formSubmitPoll.reset();
      
      await loadScheduleConfig();
    } catch (err) {
      showToast(err.message || formatDbError(err), "error");
    } finally {
      hideLoading();
    }
  });
}

if (btnResetLocal) {
  btnResetLocal.addEventListener("click", () => {
    localStorage.removeItem("krenova_has_voted_locally");
    loadScheduleConfig();
  });
}

// Auth action button in header
if (btnAuthAction) {
  btnAuthAction.addEventListener("click", async () => {
    if (currentUser) {
      showLoading("Mengakhiri sesi...");
      try {
        await signOutUser();
        showToast("Anda telah keluar dari portal.", "info");
        selectedPelajarId = null;
        selectedUmumId = null;
        currentUser = null;
        await loadScheduleConfig();
      } catch (error) {
        showToast("Gagal keluar dari sesi.", "error");
      } finally {
        hideLoading();
      }
    } else {
      showLoading("Menghubungkan ke Google Account...");
      try {
        const user = await signInWithGoogle();
        currentUser = user;
        showToast(`Selamat datang, ${user.fullName || user.email}!`, "success");
        await loadScheduleConfig();
      } catch (error) {
        console.error("Login Gagal:", error);
        showToast(error.message || "Gagal masuk dengan Google Account.", "error");
      } finally {
        hideLoading();
      }
    }
  });
}

// Google Login button inside the voting confirmation box
if (btnPollLoginGoogle) {
  btnPollLoginGoogle.addEventListener("click", async () => {
    showLoading("Menghubungkan ke Google Account...");
    try {
      const user = await signInWithGoogle();
      currentUser = user;
      showToast(`Selamat datang, ${user.fullName || user.email}!`, "success");
      await loadScheduleConfig();
    } catch (error) {
      console.error("Login Gagal:", error);
      showToast(error.message || "Gagal masuk dengan Google Account.", "error");
    } finally {
      hideLoading();
    }
  });
}


