import {
  signUpUser,
  signInUser,
  signOutUser,
  onAuthStateChangedListener,
  getCurrentUser,
  signInWithGoogle,
  signInWithX,
  signInWithFacebook,
} from "./auth.js";
import {
  saveProposal,
  getUserProposals,
  getAllProposals,
  getProposalById,
  deleteProposal,
  updateProposalStatus,
  getBidangLomba,
  saveBidangLomba,
  deleteBidangLomba,
  saveEvaluation,
  getProposalEvaluations,
  getJuriEvaluations,
  getAllEvaluations,
  getSystemConfig,
  saveSystemConfig,
  listUsersByRole,
  listAllUsers,
  saveUserProfile,
  deleteUserProfile,
  getAIAnalysis,
  saveAIAnalysis,
  getPollVotes,
  checkHasVoted,
  castVote
} from "./db.js";
import { uploadFile } from "./storage.js";

// Global App State
let currentUser = null;
let currentStep = 1;
let userProposals = [];
let isRegistrationClosed = false;
let wizardMap = null;
let wizardMarker = null;
let uploadedProductPhotos = [];
let activeUserFilter = "all";

// DOM Elements
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");
const toastContainer = document.getElementById("toast-container");
const btnAuthAction = document.getElementById("btn-auth-action");
const navUserEmail = document.getElementById("nav-user-email");
const btnThemeToggle = document.getElementById("btn-theme-toggle");

// View Sections
const sectionLanding = document.getElementById("section-landing");
const sectionAuth = document.getElementById("section-auth");
const sectionDashboard = document.getElementById("section-dashboard");
const sectionForm = document.getElementById("section-form");

// Auth Tabs and Forms
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const btnBackToLanding = document.getElementById("btn-back-to-landing");
const btnGoogleAuth = document.getElementById("btn-google-auth");
const btnXAuth = document.getElementById("btn-x-auth");
const btnFacebookAuth = document.getElementById("btn-facebook-auth");

// Dashboard Elements
const dashboardWelcome = document.getElementById("dashboard-welcome");
const btnCreateProposal = document.getElementById("btn-create-proposal");
const proposalEmptyState = document.getElementById("proposal-empty-state");
const proposalGrid = document.getElementById("proposal-grid");
const tabFilters = document.querySelectorAll(".tab-filter");

// Stats Elements
const statTotal = document.getElementById("stat-total-props");
const statDraft = document.getElementById("stat-draft-props");
const statSubmitted = document.getElementById("stat-submitted-props");
const statAccepted = document.getElementById("stat-accepted-props");

// Wizard Form Elements
const wizardForm = document.getElementById("proposal-wizard-form");
const btnCancelWizard = document.getElementById("btn-cancel-wizard");
const btnWizardPrev = document.getElementById("btn-wizard-prev");
const btnWizardNext = document.getElementById("btn-wizard-next");
const btnSaveDraft = document.getElementById("btn-save-draft");
const wizardProgressBar = document.getElementById("wizard-progress-bar");
const stepDots = document.querySelectorAll(".step-dot");

// Modal Elements
const modalDetail = document.getElementById("modal-proposal-detail");
const btnCloseDetail = document.getElementById("btn-close-detail");
const btnDetailEdit = document.getElementById("btn-detail-edit");
const btnDetailDelete = document.getElementById("btn-detail-delete");
const btnPrintDetail = document.getElementById("btn-print-detail");
let activeDetailProposal = null;

// Quill Editors State
const editors = {};
const editorIds = [
  "abstrak",
  "background",
  "objectives",
  "benefits",
  "keunggulan",
  "aspek",
  "penerapan",
  "budget",
];

// Initialize Quill Editors
editorIds.forEach((id) => {
  const container = document.getElementById(`editor-${id}`);
  if (container) {
    editors[id] = new Quill(`#editor-${id}`, {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, 4, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ script: "sub" }, { script: "super" }],
          [
            { list: "ordered" },
            { list: "bullet" },
            { indent: "-1" },
            { indent: "+1" },
          ],
          [{ align: [] }],
          ["link", "image", "code-block"],
          ["clean"],
        ],
      },
      placeholder: `Tulis ${id === "abstrak" ? "abstrak / ringkasan" : id === "background" ? "latar belakang" : id === "objectives" ? "maksud dan tujuan" : id === "benefits" ? "manfaat inovasi" : id === "keunggulan" ? "keunggulan inovasi" : id === "aspek" ? "aspek inovasi" : id === "penerapan" ? "penerapan inovasi" : "anggaran"} di sini...`,
    });
  }
});

function getEditorHTML(id) {
  if (!editors[id]) return "";
  const html = editors[id].root.innerHTML;
  if (html === "<p><br></p>" || html === "<p></p>" || html === "") return "";
  return html;
}

// Initialize Lucide Icons
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ----------------------------------------------------
// UI UTILITIES & TOASTS
// ----------------------------------------------------
function showLoading(text = "Memproses data...") {
  loadingText.textContent = text;
  loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay.classList.add("hidden");
}

function showToast(message, type = "info") {
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

// Translate and detail Firebase Auth errors
function formatAuthError(error) {
  const code = error.code || "";
  const message = error.message || "";

  console.error("Auth Error details:", error);

  if (
    code === "auth/configuration-not-found" ||
    message.includes("configuration-not-found")
  ) {
    return "Metode login (Google/Email) belum diaktifkan di Firebase Console! Aktifkan di menu Authentication -> Sign-in method.";
  }
  if (
    code === "auth/operation-not-allowed" ||
    message.includes("operation-not-allowed")
  ) {
    return "Metode masuk ini tidak diizinkan. Harap aktifkan di Firebase Console.";
  }
  if (
    code === "auth/popup-closed-by-user" ||
    message.includes("popup-closed-by-user")
  ) {
    return "Proses masuk Google dibatalkan karena jendela popup ditutup.";
  }
  if (
    code === "auth/invalid-credential" ||
    message.includes("invalid-credential")
  ) {
    return "Email atau password salah. Silakan coba lagi.";
  }
  if (
    code === "auth/email-already-in-use" ||
    message.includes("email-already-in-use")
  ) {
    return "Email sudah terdaftar. Silakan gunakan email lain.";
  }
  if (code === "auth/weak-password" || message.includes("weak-password")) {
    return "Password terlalu lemah. Minimal harus terdiri dari 6 karakter.";
  }
  return message || "Terjadi kesalahan saat masuk.";
}

// Translate and detail Firebase Database/Firestore errors
function formatDbError(error) {
  const code = error.code || "";
  const message = error.message || "";

  console.error("Database Error details:", error);

  if (
    code === "unavailable" ||
    message.includes("offline") ||
    message.includes("unavailable")
  ) {
    return "Koneksi ke Firestore gagal. Pastikan koneksi internet aktif dan database Firestore telah dibuat di Firebase Console.";
  }
  if (code === "permission-denied" || message.includes("permission-denied")) {
    return "Akses ditolak oleh aturan keamanan (Security Rules). Pastikan aturan firestore.rules telah dideploy.";
  }
  return message || "Gagal memproses data di database.";
}

// Section Navigation State Machine
function showSection(sectionId) {
  // Hide all sections
  [sectionLanding, sectionAuth, sectionDashboard, sectionForm].forEach(
    (sec) => {
      if (sec) {
        sec.classList.add("hidden");
        sec.classList.remove("active");
      }
    },
  );

  // Show target section
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("active");
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Scroll progress bar
window.addEventListener("scroll", () => {
  const winScroll =
    document.body.scrollTop || document.documentElement.scrollTop;
  const height =
    document.documentElement.scrollHeight -
    document.documentElement.clientHeight;
  const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
  const indicator = document.getElementById("scroll-progress");
  if (indicator) indicator.style.width = scrolled + "%";
});

// Password visibility toggles
document.querySelectorAll(".btn-toggle-password").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = btn.parentElement.querySelector("input");
    const icon = btn.querySelector("i");
    if (input.type === "password") {
      input.type = "text";
      icon.setAttribute("data-lucide", "eye-off");
    } else {
      input.type = "password";
      icon.setAttribute("data-lucide", "eye");
    }
    refreshIcons();
  });
});

// Toggle Demo Warning Banner if running in local Mock Mode
if (window.isFirebaseMocked) {
  const badge = document.getElementById("auth-mock-badge");
  if (badge) badge.classList.remove("hidden");
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

// ----------------------------------------------------
// AUTHENTICATION & LOGIN/REGISTER FLOWS
// ----------------------------------------------------

// Tab switching
if (tabLogin && tabRegister && formLogin && formRegister) {
  tabLogin.addEventListener("click", () => {
    tabLogin.className =
      "flex-1 text-center font-display font-extrabold text-lg pb-2 border-b-2 border-indigo-500 text-white transition-all";
    tabRegister.className =
      "flex-1 text-center font-display font-bold text-lg pb-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition-all";
    formLogin.classList.remove("hidden");
    formRegister.classList.add("hidden");
  });

  tabRegister.addEventListener("click", () => {
    tabRegister.className =
      "flex-1 text-center font-display font-extrabold text-lg pb-2 border-b-2 border-indigo-500 text-white transition-all";
    tabLogin.className =
      "flex-1 text-center font-display font-bold text-lg pb-2 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition-all";
    formRegister.classList.remove("hidden");
    formLogin.classList.add("hidden");
  });
}

// Login Form Submit
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;

    showLoading("Memverifikasi kredensial...");
    try {
      const user = await signInUser(email, pass);
      showToast(`Selamat datang kembali, ${user.email}!`, "success");
      formLogin.reset();
    } catch (error) {
      showToast(formatAuthError(error), "error");
    } finally {
      hideLoading();
    }
  });
}

// Register Form Submit
if (formRegister) {
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const pass = document.getElementById("register-password").value;

    if (pass.length < 6) {
      showToast("Password minimal berukuran 6 karakter!", "warning");
      return;
    }

    showLoading("Membuat akun baru...");
    try {
      await signUpUser(email, pass, name);
      showToast("Akun berhasil didaftarkan!", "success");
      formRegister.reset();
    } catch (error) {
      showToast(formatAuthError(error), "error");
    } finally {
      hideLoading();
    }
  });
}

// Google Sign-In Action
if (btnGoogleAuth) {
  btnGoogleAuth.addEventListener("click", async () => {
    showLoading("Menghubungkan dengan Google...");
    try {
      const user = await signInWithGoogle();
      showToast(
        `Berhasil masuk dengan Google: ${user.fullName || user.email}`,
        "success",
      );
    } catch (error) {
      showToast(formatAuthError(error), "error");
    } finally {
      hideLoading();
    }
  });
}

// X (formerly Twitter) Sign-In Action
if (btnXAuth) {
  btnXAuth.addEventListener("click", async () => {
    showLoading("Menghubungkan dengan X...");
    try {
      const user = await signInWithX();
      showToast(
        `Berhasil masuk dengan X: ${user.fullName || user.email}`,
        "success",
      );
    } catch (error) {
      showToast(formatAuthError(error), "error");
    } finally {
      hideLoading();
    }
  });
}

// Facebook Sign-In Action
if (btnFacebookAuth) {
  btnFacebookAuth.addEventListener("click", async () => {
    showLoading("Menghubungkan dengan Facebook...");
    try {
      const user = await signInWithFacebook();
      showToast(
        `Berhasil masuk dengan Facebook: ${user.fullName || user.email}`,
        "success",
      );
    } catch (error) {
      showToast(formatAuthError(error), "error");
    } finally {
      hideLoading();
    }
  });
}

// Auth button header action toggle
if (btnAuthAction) {
  btnAuthAction.addEventListener("click", async () => {
    if (currentUser) {
      showLoading("Mengakhiri sesi...");
      try {
        await signOutUser();
        showToast("Anda telah keluar dari portal.", "info");
        showSection("section-landing");
      } catch (error) {
        showToast("Gagal keluar dari sesi.", "error");
      } finally {
        hideLoading();
      }
    } else {
      showSection("section-auth");
    }
  });
}

if (btnBackToLanding) {
  btnBackToLanding.addEventListener("click", () => {
    showSection("section-landing");
  });
}

// ----------------------------------------------------
// ROLE-BASED SIDEBAR & DASHBOARD ORCHESTRATION
// ----------------------------------------------------

const roleMenus = {
  peserta: [
    {
      label: "Proposal Saya",
      icon: "folder",
      panel: "panel-peserta-proposals",
      subtitle: "Kelola proposal inovasi Anda di sini",
    },
    {
      label: "Edit Profil",
      icon: "user",
      panel: "panel-peserta-profile",
      subtitle: "Perbarui profil dan informasi kontak Anda",
    },
  ],
  juri: [
    {
      label: "Statistik Juri",
      icon: "bar-chart-2",
      panel: "panel-juri-stats",
      subtitle: "Rangkuman penilaian proposal Anda",
    },
    {
      label: "Penilaian Proposal",
      icon: "award",
      panel: "panel-juri-penilaian",
      subtitle: "Evaluasi dan beri nilai proposal peserta",
    },
    {
      label: "Jadwal Kegiatan",
      icon: "calendar",
      panel: "panel-juri-jadwal",
      subtitle: "Jadwal entri proposal dan penilaian",
    },
  ],
  admin: [
    {
      label: "Statistik Portal",
      icon: "bar-chart-2",
      panel: "panel-admin-stats",
      subtitle: "Statistik dan ringkasan data kompetisi",
    },
    {
      label: "Kelola Bidang",
      icon: "tag",
      panel: "panel-admin-bidang",
      subtitle: "Manajemen kategori / bidang lomba",
    },
    {
      label: "Kelola Proposal",
      icon: "file-text",
      panel: "panel-admin-proposals",
      subtitle: "Verifikasi administrasi proposal peserta",
    },
    {
      label: "Kelola Penilaian",
      icon: "award",
      panel: "panel-admin-penilaian",
      subtitle: "Pantau rekapitulasi skor dari dewan juri",
    },
    {
      label: "Kelola Jadwal",
      icon: "calendar",
      panel: "panel-admin-jadwal",
      subtitle: "Konfigurasi linimasa kompetisi",
    },
    {
      label: "Kelola Users",
      icon: "user-check",
      panel: "panel-admin-users",
      subtitle: "Manajemen seluruh user dalam sistem",
    },
    {
      label: "Hasil Polling",
      icon: "thumbs-up",
      panel: "panel-admin-polling",
      subtitle: "Hasil suara/vote polling proposal inovasi",
    },
  ],
};

// Listen for Authentication State Changes
onAuthStateChangedListener(async (user) => {
  currentUser = user;

  const elFloatingCountdown = document.getElementById("floating-countdown");
  if (user) {
    // Authenticated state
    if (navUserEmail) {
      navUserEmail.textContent = user.email;
      navUserEmail.classList.remove("hidden");
    }

    if (btnAuthAction) {
      btnAuthAction.innerHTML = `<i data-lucide="log-out" class="w-4 h-4"></i><span>Keluar Portal</span>`;
    }
    if (dashboardWelcome) {
      dashboardWelcome.textContent = `Selamat datang kembali, ${user.fullName || user.email}`;
    }

    // Show countdown only for participant (peserta), hide for admin/juri
    if (elFloatingCountdown) {
      if (user.role === "admin" || user.role === "juri") {
        elFloatingCountdown.classList.add("hidden");
      } else {
        elFloatingCountdown.classList.remove("hidden");
      }
    }

    // Load schedule config
    await loadScheduleConfig();

    // Switch to dashboard if the user is in landing or auth sections
    const activeSec = document.querySelector(".view-section.active");
    if (
      activeSec &&
      (activeSec.id === "section-landing" || activeSec.id === "section-auth")
    ) {
      showSection("section-dashboard");
    }

    initializeRoleDashboard(user);
  } else {
    // Unauthenticated state
    if (navUserEmail) {
      navUserEmail.textContent = "";
      navUserEmail.classList.add("hidden");
    }

    if (btnAuthAction) {
      btnAuthAction.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Login</span>`;
    }

    // Show countdown for guests (default landing view)
    if (elFloatingCountdown) {
      elFloatingCountdown.classList.remove("hidden");
    }

    // Switch back to landing if user was on protected sections
    const activeSec = document.querySelector(".view-section.active");
    if (
      activeSec &&
      (activeSec.id === "section-dashboard" || activeSec.id === "section-form")
    ) {
      showSection("section-landing");
    }

    // Direct to login section if "?login=true" is passed
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("login") === "true") {
      showSection("section-auth");
      // Clean up the URL search param so refresh doesn't force auth screen
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
  refreshIcons();
});

function initializeRoleDashboard(user) {
  const elAvatar = document.getElementById("sidebar-user-avatar");
  const elName = document.getElementById("sidebar-user-name");
  const elEmail = document.getElementById("sidebar-user-email");
  const elRoleBadge = document.getElementById("sidebar-user-role-badge");

  const displayName = user.fullName || user.email.split("@")[0];
  if (elAvatar) elAvatar.textContent = displayName[0].toUpperCase();
  if (elName) elName.textContent = displayName;
  if (elEmail) elEmail.textContent = user.email;

  if (elRoleBadge) {
    elRoleBadge.textContent = user.role.toUpperCase();
    elRoleBadge.className =
      "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ";
    if (user.role === "admin") {
      elRoleBadge.className +=
        "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    } else if (user.role === "juri") {
      elRoleBadge.className +=
        "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
    } else {
      elRoleBadge.className +=
        "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
    }
  }

  // Clear and populate sidebar menu
  const sidebarNavMenu = document.getElementById("sidebar-nav-menu");
  if (sidebarNavMenu) {
    sidebarNavMenu.innerHTML = "";
    const menus = roleMenus[user.role] || [];
    menus.forEach((menu, idx) => {
      const btn = document.createElement("button");
      btn.className =
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-slate-400 hover:text-white hover:bg-white/5 text-left";
      btn.innerHTML = `<i data-lucide="${menu.icon}" class="w-4 h-4"></i><span>${menu.label}</span>`;
      btn.addEventListener("click", () => {
        activateDashboardPanel(menu.panel, menu.label, menu.subtitle, btn);
      });
      sidebarNavMenu.appendChild(btn);

      // Auto-click the first tab
      if (idx === 0) {
        btn.click();
      }
    });
  }
  refreshIcons();
}

function activateDashboardPanel(panelId, title, subtitle, navBtn) {
  const menuButtons = document.querySelectorAll("#sidebar-nav-menu button");
  menuButtons.forEach((btn) => {
    btn.className =
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all text-left";
  });
  if (navBtn) {
    navBtn.className =
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-600/10 transition-all text-left";
  }

  // Hide all panels, show the selected one
  document
    .querySelectorAll(".dashboard-panel")
    .forEach((p) => p.classList.add("hidden"));
  const activePanel = document.getElementById(panelId);
  if (activePanel) {
    activePanel.classList.remove("hidden");
  }

  // Set up header action button dynamically
  let actionHtml = "";
  let actionCallback = null;

  if (panelId === "panel-peserta-proposals") {
    actionHtml = `
      <button id="btn-create-proposal-header" class="btn-glow px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/10 active:scale-98 transition-all flex items-center gap-1.5">
        <i data-lucide="plus" class="w-4 h-4"></i>
        <span>Buat Proposal Baru</span>
      </button>
    `;
    actionCallback = () => startProposalWizard();
  } else if (panelId === "panel-admin-users") {
    actionHtml = `
      <button id="btn-admin-add-user" class="btn-glow px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/10 active:scale-98 transition-all flex items-center gap-1.5">
        <i data-lucide="user-plus" class="w-4 h-4"></i>
        <span>Tambah User</span>
      </button>
    `;
    actionCallback = () => openUserModal();
  } else if (panelId === "panel-admin-bidang") {
    actionHtml = `
      <button id="btn-admin-add-bidang" class="btn-glow px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/10 active:scale-98 transition-all flex items-center gap-1.5">
        <i data-lucide="plus" class="w-4 h-4"></i>
        <span>Tambah Bidang</span>
      </button>
    `;
    actionCallback = () => openBidangModal();
  } else if (panelId === "panel-admin-penilaian") {
    actionHtml = `
      <button id="btn-print-evaluations-report" class="btn-glow px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/10 active:scale-98 transition-all flex items-center gap-1.5">
        <i data-lucide="printer" class="w-4 h-4"></i>
        <span>Cetak Laporan Hasil</span>
      </button>
    `;
    actionCallback = () => printEvaluationReport();
  }

  updateDashboardHeader(title, subtitle, actionHtml, actionCallback);
  loadPanelData(panelId);
}

function updateDashboardHeader(
  title,
  subtitle,
  actionHtml = "",
  actionCallback = null,
) {
  const elTitle = document.getElementById("dashboard-main-title");
  const elSubtitle = document.getElementById("dashboard-main-subtitle");
  const elActionContainer = document.getElementById(
    "dashboard-action-container",
  );

  if (elTitle) elTitle.textContent = title;
  if (elSubtitle) elSubtitle.textContent = subtitle;
  if (elActionContainer) {
    elActionContainer.innerHTML = actionHtml;
    if (actionHtml && actionCallback) {
      const firstBtn = elActionContainer.querySelector("button");
      if (firstBtn) {
        firstBtn.addEventListener("click", actionCallback);
      }
    }
  }
  refreshIcons();
}

async function loadPanelData(panelId) {
  if (!currentUser) return;

  try {
    if (panelId === "panel-peserta-proposals") {
      await loadPesertaProposals();
    } else if (panelId === "panel-peserta-profile") {
      loadPesertaProfileForm();
    } else if (panelId === "panel-juri-stats") {
      await loadJuriStats();
    } else if (panelId === "panel-juri-penilaian") {
      await loadJuriPenilaian();
    } else if (panelId === "panel-admin-stats") {
      await loadAdminStats();
    } else if (panelId === "panel-admin-bidang") {
      await loadAdminBidangLomba();
    } else if (panelId === "panel-admin-proposals") {
      await loadAdminProposals();
    } else if (panelId === "panel-admin-penilaian") {
      await loadAdminPenilaian();
    } else if (panelId === "panel-admin-users") {
      await loadAdminUsers();
    } else if (panelId === "panel-admin-polling") {
      await loadAdminPollingResults();
    }
  } catch (error) {
    showToast(formatDbError(error), "error");
  }
}

// ----------------------------------------------------
// PESERTA DASHBOARD LOADERS & HANDLERS
// ----------------------------------------------------
async function loadPesertaProposals() {
  const proposals = await getUserProposals(currentUser.uid);
  const total = proposals.length;
  const draft = proposals.filter((p) => p.status === "Draft").length;
  const submitted = proposals.filter(
    (p) =>
      p.status === "Submitted" ||
      p.status === "Under Review" ||
      p.status === "Approved" ||
      p.status === "Rejected",
  ).length;
  const accepted = proposals.filter((p) => p.status === "Accepted").length;

  document.getElementById("peserta-stat-total").textContent = total;
  document.getElementById("peserta-stat-draft").textContent = draft;
  document.getElementById("peserta-stat-submitted").textContent = submitted;
  document.getElementById("peserta-stat-accepted").textContent = accepted;

  renderPesertaGrid(proposals, "all");
}

function renderPesertaGrid(proposals, filter = "all") {
  const grid = document.getElementById("peserta-proposals-grid");
  const empty = document.getElementById("peserta-proposals-empty");
  if (!grid) return;
  grid.innerHTML = "";

  const filtered =
    filter === "all"
      ? proposals
      : proposals.filter((p) => {
          if (filter === "Draft") return p.status === "Draft";
          if (filter === "Submitted")
            return (
              p.status === "Submitted" ||
              p.status === "Under Review" ||
              p.status === "Approved" ||
              p.status === "Rejected"
            );
          if (filter === "Accepted") return p.status === "Accepted";
          return p.status === filter;
        });

  if (filtered.length === 0) {
    grid.classList.add("hidden");
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");
  grid.classList.remove("hidden");

  filtered.forEach((prop) => {
    const card = document.createElement("div");
    card.className =
      "glass-card rounded-2xl p-6 flex flex-col justify-between cursor-pointer animate-fade-in-up";

    let statusClass = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    let statusDot = "bg-indigo-400";
    if (prop.status === "Draft") {
      statusClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
      statusDot = "bg-amber-400";
    } else if (prop.status === "Under Review") {
      statusClass = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      statusDot = "bg-cyan-400";
    } else if (prop.status === "Approved" || prop.status === "Accepted") {
      statusClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      statusDot = "bg-emerald-400";
    } else if (prop.status === "Rejected") {
      statusClass = "bg-red-500/10 text-red-400 border-red-500/20";
      statusDot = "bg-red-400";
    }

    const displayDate = new Date(prop.updatedAt).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    card.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-start justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusClass}">
            <span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span>
            ${prop.status}
          </span>
          <span class="text-xs text-slate-500 font-mono">${displayDate}</span>
        </div>

        <div>
          <h3 class="font-display font-bold text-white text-base line-clamp-1 hover:text-indigo-400 transition-colors">${prop.title}</h3>
          <p class="text-xs text-slate-400 line-clamp-2 mt-2 leading-relaxed">${prop.description}</p>
        </div>
      </div>

      <div class="border-t border-white/5 pt-4 mt-6 flex items-center justify-between text-xs text-slate-500">
        <span class="flex items-center gap-1.5">
          <i data-lucide="tag" class="w-4 h-4 text-indigo-400"></i>
          <span>${prop.bidang || prop.category}</span>
        </span>
        <span class="font-medium text-indigo-400 group-hover:underline">Lihat Detail &rarr;</span>
      </div>
    `;
    card.addEventListener("click", () => showProposalDetail(prop.id));
    grid.appendChild(card);
  });
  refreshIcons();
}

const pFilters = document.querySelectorAll(
  "#panel-peserta-proposals .tab-filter",
);
pFilters.forEach((btn) => {
  btn.addEventListener("click", () => {
    pFilters.forEach((b) => {
      b.className =
        "tab-filter px-4 py-2 text-sm font-semibold rounded-lg hover:bg-white/5 border border-transparent text-slate-400 transition-all";
    });
    btn.className =
      "tab-filter px-4 py-2 text-sm font-semibold rounded-lg bg-white/5 border border-white/10 text-white transition-all";
    const filter = btn.getAttribute("data-filter");
    getUserProposals(currentUser.uid).then((props) =>
      renderPesertaGrid(props, filter),
    );
  });
});

const uFilters = document.querySelectorAll(".user-tab-filter");
uFilters.forEach((btn) => {
  btn.addEventListener("click", async () => {
    uFilters.forEach((b) => {
      b.className =
        "user-tab-filter px-4 py-2 text-sm font-semibold rounded-lg hover:bg-white/5 border border-transparent text-slate-400 transition-all";
    });
    btn.className =
      "user-tab-filter px-4 py-2 text-sm font-semibold rounded-lg bg-white/5 border border-white/10 text-white transition-all";
    activeUserFilter = btn.getAttribute("data-user-filter");
    await loadAdminUsers();
  });
});

function loadPesertaProfileForm() {
  const elName = document.getElementById("profile-name");
  const elPhone = document.getElementById("profile-phone");
  const elAddress = document.getElementById("profile-address");
  const elKategori = document.getElementById("profile-kategori");

  if (elName) elName.value = currentUser.fullName || "";
  if (elPhone) elPhone.value = currentUser.phone || "";
  if (elAddress) elAddress.value = currentUser.address || "";
  if (elKategori) elKategori.value = currentUser.kategori || "Pelajar";
}

const formProfile = document.getElementById("form-profile-editor");
if (formProfile) {
  formProfile.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("profile-name").value.trim();
    const phone = document.getElementById("profile-phone").value.trim();
    const address = document.getElementById("profile-address").value.trim();
    const kategori = document.getElementById("profile-kategori").value;

    showLoading("Menyimpan profil...");
    try {
      const updated = await saveUserProfile(currentUser.uid, {
        fullName,
        phone,
        address,
        kategori,
      });
      currentUser = { ...currentUser, ...updated };
      showToast("Profil berhasil disimpan.", "success");
      initializeRoleDashboard(currentUser);
    } catch (err) {
      showToast(formatDbError(err), "error");
    } finally {
      hideLoading();
    }
  });
}

// ----------------------------------------------------
// JURI DASHBOARD LOADERS & HANDLERS
// ----------------------------------------------------
async function loadJuriStats() {
  const proposals = await getAllProposals(currentUser?.role);
  const evaluations = await getJuriEvaluations(currentUser.uid);

  const approvedProps = proposals.filter((p) => p.status === "Approved");
  const total = approvedProps.length;
  const scored = evaluations.length;
  const unscored = total - scored;

  const elTotal = document.getElementById("juri-stat-total");
  const elScored = document.getElementById("juri-stat-scored");
  const elUnscored = document.getElementById("juri-stat-unscored");

  if (elTotal) elTotal.textContent = total;
  if (elScored) elScored.textContent = scored;
  if (elUnscored) elUnscored.textContent = Math.max(0, unscored);
}

async function loadJuriPenilaian() {
  const proposals = await getAllProposals(currentUser?.role);
  const evaluations = await getJuriEvaluations(currentUser.uid);
  renderJuriTable(proposals, evaluations, "unscored");
}

function renderJuriTable(proposals, evaluations, filter = "unscored") {
  const tbody = document.getElementById("table-juri-proposals-body");
  const empty = document.getElementById("table-juri-empty");
  if (!tbody) return;
  tbody.innerHTML = "";

  const evalMap = {};
  evaluations.forEach((e) => {
    evalMap[e.proposalId] = e;
  });

  let filtered = [];
  if (filter === "unscored") {
    filtered = proposals.filter(
      (p) => p.status === "Approved" && !evalMap[p.id],
    );
  } else if (filter === "scored") {
    filtered = proposals.filter(
      (p) => p.status === "Approved" && evalMap[p.id],
    );
  } else if (filter === "approved") {
    filtered = proposals.filter((p) => p.status === "Approved");
  } else if (filter === "rejected") {
    filtered = proposals.filter((p) => p.status === "Rejected");
  }

  if (filtered.length === 0) {
    tbody.classList.add("hidden");
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");
  tbody.classList.remove("hidden");

  filtered.forEach((prop) => {
    const hasScore = evalMap[prop.id];
    const displayScore = hasScore ? hasScore.average.toFixed(2) : "-";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-white/5 transition-colors border-b border-white/5";
    tr.innerHTML = `
      <td class="px-6 py-4 font-semibold text-white truncate max-w-xs">${prop.title}</td>
      <td class="px-6 py-4">${prop.fullName || prop.authorEmail}</td>
      <td class="px-6 py-4">${prop.bidang || prop.category}</td>
      <td class="px-6 py-4 font-mono font-bold ${hasScore ? "text-indigo-400" : "text-slate-500"}">${displayScore}</td>
      <td class="px-6 py-4 text-right">
        <div class="flex items-center justify-end gap-2">
          <button class="btn-view-prop p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors" title="Lihat Detail">
            <i data-lucide="eye" class="w-4 h-4"></i>
          </button>
          ${
            prop.status === "Approved"
              ? `
            <button class="btn-score-prop px-3 py-1.5 rounded-lg text-xs font-bold ${hasScore ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"} transition-all">
              ${hasScore ? "Ubah Nilai" : "Beri Nilai"}
            </button>
          `
              : ""
          }
        </div>
      </td>
    `;

    tr.querySelector(".btn-view-prop").addEventListener("click", () =>
      showProposalDetail(prop.id),
    );

    const btnScore = tr.querySelector(".btn-score-prop");
    if (btnScore) {
      btnScore.addEventListener("click", () => openScoreModal(prop, hasScore));
    }

    tbody.appendChild(tr);
  });
  refreshIcons();
}

const jFilters = document.querySelectorAll(".tab-jfilter");
jFilters.forEach((btn) => {
  btn.addEventListener("click", () => {
    jFilters.forEach((b) => {
      b.className =
        "tab-jfilter px-4 py-2 text-sm font-semibold rounded-lg hover:bg-white/5 border border-transparent text-slate-400 transition-all whitespace-nowrap";
    });
    btn.className =
      "tab-jfilter px-4 py-2 text-sm font-semibold rounded-lg bg-white/5 border border-white/10 text-white transition-all whitespace-nowrap";
    const filter = btn.getAttribute("data-jfilter");
    Promise.all([
      getAllProposals(currentUser?.role),
      getJuriEvaluations(currentUser.uid),
    ]).then(([props, evals]) => {
      renderJuriTable(props, evals, filter);
    });
  });
});

function openScoreModal(prop, existingScore) {
  const modal = document.getElementById("modal-juri-score");
  if (!modal) return;

  document.getElementById("score-proposal-id").value = prop.id;
  document.getElementById("score-proposal-title").textContent = prop.title;

  const fields = ["orisinalitas", "penerapan", "manfaat", "keberlangsungan"];
  fields.forEach((f) => {
    const input = document.getElementById(`score-${f}`);
    const val =
      existingScore && existingScore.scores ? existingScore.scores[f] : 80;
    if (input) input.value = val;
  });

  document.getElementById("score-comment").value = existingScore
    ? existingScore.comment || ""
    : "";
  calculateScoreAverage();
  modal.showModal();
}

const formScore = document.getElementById("form-juri-score");
if (formScore) {
  formScore.addEventListener("submit", async (e) => {
    e.preventDefault();
    const propId = document.getElementById("score-proposal-id").value;
    const orisinalitas = parseFloat(
      document.getElementById("score-orisinalitas").value,
    );
    const penerapan = parseFloat(
      document.getElementById("score-penerapan").value,
    );
    const manfaat = parseFloat(document.getElementById("score-manfaat").value);
    const keberlangsungan = parseFloat(
      document.getElementById("score-keberlangsungan").value,
    );
    const comment = document.getElementById("score-comment").value.trim();
    const average = (orisinalitas + penerapan + manfaat + keberlangsungan) / 4;

    showLoading("Menyimpan penilaian...");
    try {
      await saveEvaluation({
        proposalId: propId,
        juriId: currentUser.uid,
        juriName: currentUser.fullName || currentUser.email,
        scores: { orisinalitas, penerapan, manfaat, keberlangsungan },
        average,
        comment,
      });
      showToast("Penilaian berhasil disimpan.", "success");
      document.getElementById("modal-juri-score").close();
      await loadJuriPenilaian();
    } catch (err) {
      showToast(formatDbError(err), "error");
    } finally {
      hideLoading();
    }
  });
}

// Number input listeners: clamp 1-100 and recalculate average
const scoreFields = ["orisinalitas", "penerapan", "manfaat", "keberlangsungan"];
scoreFields.forEach((fieldName) => {
  const input = document.getElementById(`score-${fieldName}`);
  if (input) {
    input.addEventListener("input", () => {
      calculateScoreAverage();
    });
    input.addEventListener("blur", () => {
      let v = parseInt(input.value, 10);
      if (isNaN(v) || v < 1) v = 1;
      if (v > 100) v = 100;
      input.value = v;
      calculateScoreAverage();
    });
  }
});

function calculateScoreAverage() {
  const vals = ["orisinalitas", "penerapan", "manfaat", "keberlangsungan"].map(
    (id) => {
      const el = document.getElementById(`score-${id}`);
      return el ? parseFloat(el.value) || 0 : 0;
    },
  );
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const avgDisplay = document.getElementById("score-avg-display");
  if (avgDisplay) avgDisplay.textContent = avg.toFixed(2);
  return avg;
}

// ----------------------------------------------------
// ADMIN DASHBOARD LOADERS & HANDLERS
// ----------------------------------------------------
async function loadAdminStats() {
  const proposals = await getAllProposals();
  const users = await listAllUsers();
  const evaluations = await getAllEvaluations();

  const totalProps = proposals.length;
  const totalUsers = users.length;
  const totalJuries = users.filter((u) => u.role === "juri").length;

  // Scored props: unique proposalId in evaluations
  const scoredPropIds = new Set(evaluations.map((e) => e.proposalId));
  const totalScored = scoredPropIds.size;

  const elProps = document.getElementById("admin-stat-proposals");
  const elUsers = document.getElementById("admin-stat-users");
  const elJuries = document.getElementById("admin-stat-juries");
  const elScored = document.getElementById("admin-stat-scored");

  if (elProps) elProps.textContent = totalProps;
  if (elUsers) elUsers.textContent = totalUsers;
  if (elJuries) elJuries.textContent = totalJuries;
  if (elScored) elScored.textContent = totalScored;

  // Calculate Average Scores per Category (Pelajar / Umum)
  const evalGroup = {};
  evaluations.forEach((e) => {
    if (!evalGroup[e.proposalId]) {
      evalGroup[e.proposalId] = [];
    }
    evalGroup[e.proposalId].push(e);
  });

  let totalPelajarScore = 0;
  let countPelajar = 0;
  let totalUmumScore = 0;
  let countUmum = 0;

  proposals.forEach((p) => {
    const propEvals = evalGroup[p.id];
    if (propEvals && propEvals.length > 0) {
      const avgScores = propEvals.map((e) => e.average);
      const overallAvg =
        avgScores.reduce((sum, val) => sum + val, 0) / avgScores.length;

      const cat = (p.kategoriPengusul || "Pelajar").trim().toLowerCase();
      if (cat === "umum") {
        totalUmumScore += overallAvg;
        countUmum++;
      } else {
        totalPelajarScore += overallAvg;
        countPelajar++;
      }
    }
  });

  const avgPelajar = countPelajar > 0 ? totalPelajarScore / countPelajar : 0;
  const avgUmum = countUmum > 0 ? totalUmumScore / countUmum : 0;

  const elAvgPelajar = document.getElementById("admin-avg-pelajar");
  const elCountPelajar = document.getElementById("admin-count-pelajar");
  const elAvgUmum = document.getElementById("admin-avg-umum");
  const elCountUmum = document.getElementById("admin-count-umum");

  if (elAvgPelajar) elAvgPelajar.textContent = avgPelajar.toFixed(2);
  if (elCountPelajar) elCountPelajar.textContent = `${countPelajar} proposal`;
  if (elAvgUmum) elAvgUmum.textContent = avgUmum.toFixed(2);
  if (elCountUmum) elCountUmum.textContent = `${countUmum} proposal`;
}

function openUserModal(user = null) {
  const modal = document.getElementById("modal-admin-user");
  if (!modal) return;

  if (user) {
    document.getElementById("admin-user-uid").value = user.uid;
    document.getElementById("user-name").value = user.fullName || "";
    document.getElementById("user-email").value = user.email || "";
    document.getElementById("user-role").value = user.role || "peserta";
    const pContainer = document.getElementById("user-password-container");
    if (pContainer) pContainer.classList.add("hidden");
    document.getElementById("modal-user-title").textContent = "Edit Data User";
  } else {
    document.getElementById("admin-user-uid").value = "";
    document.getElementById("form-admin-user").reset();
    document.getElementById("user-role").value = "peserta";
    const pContainer = document.getElementById("user-password-container");
    if (pContainer) pContainer.classList.remove("hidden");
    document.getElementById("modal-user-title").textContent =
      "Tambah User Baru";
  }
  modal.showModal();
}

const formUser = document.getElementById("form-admin-user");
if (formUser) {
  formUser.addEventListener("submit", async (e) => {
    e.preventDefault();
    const uid = document.getElementById("admin-user-uid").value;
    const name = document.getElementById("user-name").value.trim();
    const email = document.getElementById("user-email").value.trim();
    const role = document.getElementById("user-role").value;

    showLoading("Menyimpan data user...");
    try {
      if (uid) {
        await saveUserProfile(uid, { fullName: name, email, role });
        showToast("User berhasil diperbarui.", "success");
      } else {
        const tempUid = "pre-" + Math.random().toString(36).substr(2, 9);
        await saveUserProfile(tempUid, { email, fullName: name, role });
        showToast("User baru berhasil didaftarkan.", "success");
      }
      document.getElementById("modal-admin-user").close();
      await loadAdminUsers();
    } catch (err) {
      showToast(formatDbError(err), "error");
    } finally {
      hideLoading();
    }
  });
}

document
  .getElementById("btn-close-user-modal")
  ?.addEventListener("click", () => {
    document.getElementById("modal-admin-user").close();
  });

async function loadAdminBidangLomba() {
  const bidang = await getBidangLomba();
  renderAdminBidangTable(bidang);
}

function renderAdminBidangTable(list) {
  const tbody = document.getElementById("table-admin-bidang-body");
  const empty = document.getElementById("table-admin-bidang-empty");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.classList.add("hidden");
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");
  tbody.classList.remove("hidden");

  list.forEach((b) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-white/5 transition-colors border-b border-white/5";
    tr.innerHTML = `
      <td class="px-6 py-4 font-mono text-xs text-indigo-400 font-bold">${b.id}</td>
      <td class="px-6 py-4 font-semibold text-white">${b.nama}</td>
      <td class="px-6 py-4 text-right text-xs">
        <div class="flex items-center justify-end gap-2">
          <button class="btn-edit-bidang p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors" title="Edit Bidang">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          <button class="btn-delete-bidang p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Hapus Bidang">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    `;

    tr.querySelector(".btn-edit-bidang").addEventListener("click", () =>
      openBidangModal(b),
    );
    tr.querySelector(".btn-delete-bidang").addEventListener(
      "click",
      async () => {
        if (
          confirm(`Apakah Anda yakin ingin menghapus bidang lomba ${b.nama}?`)
        ) {
          showLoading("Menghapus bidang...");
          try {
            await deleteBidangLomba(b.id);
            showToast("Bidang lomba berhasil dihapus.", "success");
            loadAdminBidangLomba();
          } catch (e) {
            showToast(formatDbError(e), "error");
          } finally {
            hideLoading();
          }
        }
      },
    );

    tbody.appendChild(tr);
  });
  refreshIcons();
}

function openBidangModal(bidang = null) {
  const modal = document.getElementById("modal-admin-bidang");
  if (!modal) return;

  if (bidang) {
    document.getElementById("admin-bidang-id").value = bidang.id;
    document.getElementById("bidang-name").value = bidang.nama;
    document.getElementById("modal-bidang-title").textContent =
      "Edit Bidang Lomba";
  } else {
    document.getElementById("admin-bidang-id").value = "";
    document.getElementById("form-admin-bidang").reset();
    document.getElementById("modal-bidang-title").textContent =
      "Tambah Bidang Lomba";
  }
  modal.showModal();
}

const formBidang = document.getElementById("form-admin-bidang");
if (formBidang) {
  formBidang.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("admin-bidang-id").value;
    const name = document.getElementById("bidang-name").value.trim();

    showLoading("Menyimpan bidang lomba...");
    try {
      await saveBidangLomba({ id: id || null, nama: name });
      showToast("Bidang lomba berhasil disimpan.", "success");
      document.getElementById("modal-admin-bidang").close();
      await loadAdminBidangLomba();
    } catch (err) {
      showToast(formatDbError(err), "error");
    } finally {
      hideLoading();
    }
  });
}

async function loadAdminProposals() {
  const proposals = await getAllProposals();
  renderAdminProposalsTable(proposals, "all");
}

function renderAdminProposalsTable(props, filter = "all") {
  const tbody = document.getElementById("table-admin-proposals-body");
  const empty = document.getElementById("table-admin-proposals-empty");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filtered =
    filter === "all" ? props : props.filter((p) => p.status === filter);

  if (filtered.length === 0) {
    tbody.classList.add("hidden");
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");
  tbody.classList.remove("hidden");

  filtered.forEach((prop) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-white/5 transition-colors border-b border-white/5";

    let statusClass =
      "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
    if (prop.status === "Draft")
      statusClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    if (prop.status === "Approved")
      statusClass =
        "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    if (prop.status === "Rejected")
      statusClass = "bg-red-500/10 text-red-400 border border-red-500/20";

    tr.innerHTML = `
      <td class="px-6 py-4 font-semibold text-white truncate max-w-xs">${prop.title}</td>
      <td class="px-6 py-4">${prop.fullName || prop.authorEmail}</td>
      <td class="px-6 py-4">${prop.bidang || prop.category}</td>
      <td class="px-6 py-4">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold ${statusClass}">
          ${prop.status}
        </span>
      </td>
      <td class="px-6 py-4 text-right text-xs">
        <div class="flex items-center justify-end gap-2">
          <button class="btn-view-admin p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors" title="Lihat Detail">
            <i data-lucide="eye" class="w-4 h-4"></i>
          </button>
          ${
            prop.status === "Submitted"
              ? `
            <button class="btn-approve-admin px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all flex items-center gap-1">
              <i data-lucide="check" class="w-3.5 h-3.5"></i> Approve
            </button>
            <button class="btn-reject-admin px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all flex items-center gap-1">
              <i data-lucide="x" class="w-3.5 h-3.5"></i> Reject
            </button>
          `
              : ""
          }
          <button class="btn-edit-admin p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors" title="Edit Proposal">
            <i data-lucide="edit" class="w-4 h-4"></i>
          </button>
          <button class="btn-delete-admin p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Hapus Proposal">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    `;

    tr.querySelector(".btn-view-admin").addEventListener("click", () =>
      showProposalDetail(prop.id),
    );

    const btnApprove = tr.querySelector(".btn-approve-admin");
    if (btnApprove) {
      btnApprove.addEventListener("click", async () => {
        if (
          confirm(
            `Setujui proposal "${prop.title}" untuk diteruskan ke dewan juri?`,
          )
        ) {
          showLoading("Menyetujui proposal...");
          try {
            await updateProposalStatus(prop.id, "Approved");
            showToast("Proposal disetujui.", "success");
            await loadAdminProposals();
          } catch (e) {
            showToast(formatDbError(e), "error");
          } finally {
            hideLoading();
          }
        }
      });
    }

    const btnReject = tr.querySelector(".btn-reject-admin");
    if (btnReject) {
      btnReject.addEventListener("click", async () => {
        if (confirm(`Tolak proposal "${prop.title}"?`)) {
          showLoading("Menolak proposal...");
          try {
            await updateProposalStatus(prop.id, "Rejected");
            showToast("Proposal ditolak.", "warning");
            await loadAdminProposals();
          } catch (e) {
            showToast(formatDbError(e), "error");
          } finally {
            hideLoading();
          }
        }
      });
    }

    tr.querySelector(".btn-edit-admin").addEventListener("click", () =>
      editProposalDraft(prop),
    );
    tr.querySelector(".btn-delete-admin").addEventListener(
      "click",
      async () => {
        if (
          confirm(
            `Apakah Anda yakin ingin menghapus proposal "${prop.title}" secara permanen?`,
          )
        ) {
          showLoading("Menghapus proposal...");
          try {
            await deleteProposal(prop.id);
            showToast("Proposal berhasil dihapus.", "success");
            await loadAdminProposals();
          } catch (e) {
            showToast(formatDbError(e), "error");
          } finally {
            hideLoading();
          }
        }
      },
    );

    tbody.appendChild(tr);
  });
  refreshIcons();
}

const aFilters = document.querySelectorAll(".tab-afilter");
aFilters.forEach((btn) => {
  btn.addEventListener("click", () => {
    aFilters.forEach((b) => {
      b.className =
        "tab-afilter px-4 py-2 text-sm font-semibold rounded-lg hover:bg-white/5 border border-transparent text-slate-400 transition-all whitespace-nowrap";
    });
    btn.className =
      "tab-afilter px-4 py-2 text-sm font-semibold rounded-lg bg-white/5 border border-white/10 text-white transition-all whitespace-nowrap";
    const filter = btn.getAttribute("data-afilter");
    getAllProposals().then((props) => renderAdminProposalsTable(props, filter));
  });
});

async function loadAdminPenilaian() {
  const proposals = await getAllProposals();
  const evaluations = await getAllEvaluations();
  renderAdminPenilaianTable(proposals, evaluations);

  // Calculate Average Scores per Category (Pelajar / Umum) for the evaluations bar
  const evalGroup = {};
  evaluations.forEach((e) => {
    if (!evalGroup[e.proposalId]) {
      evalGroup[e.proposalId] = [];
    }
    evalGroup[e.proposalId].push(e);
  });

  let totalPelajarScore = 0;
  let countPelajar = 0;
  let totalUmumScore = 0;
  let countUmum = 0;

  proposals.forEach((p) => {
    const propEvals = evalGroup[p.id];
    if (propEvals && propEvals.length > 0) {
      const avgScores = propEvals.map((e) => e.average);
      const overallAvg =
        avgScores.reduce((sum, val) => sum + val, 0) / avgScores.length;

      const cat = (p.kategoriPengusul || "Pelajar").trim().toLowerCase();
      if (cat === "umum") {
        totalUmumScore += overallAvg;
        countUmum++;
      } else {
        totalPelajarScore += overallAvg;
        countPelajar++;
      }
    }
  });

  const avgPelajar = countPelajar > 0 ? totalPelajarScore / countPelajar : 0;
  const avgUmum = countUmum > 0 ? totalUmumScore / countUmum : 0;

  const elEvalAvgPelajar = document.getElementById("admin-eval-avg-pelajar");
  const elEvalCountPelajar = document.getElementById(
    "admin-eval-count-pelajar",
  );
  const elEvalAvgUmum = document.getElementById("admin-eval-avg-umum");
  const elEvalCountUmum = document.getElementById("admin-eval-count-umum");

  if (elEvalAvgPelajar) elEvalAvgPelajar.textContent = avgPelajar.toFixed(2);
  if (elEvalCountPelajar)
    elEvalCountPelajar.textContent = `${countPelajar} Proposal`;
  if (elEvalAvgUmum) elEvalAvgUmum.textContent = avgUmum.toFixed(2);
  if (elEvalCountUmum) elEvalCountUmum.textContent = `${countUmum} Proposal`;
}

function renderAdminPenilaianTable(props, evals) {
  const tbody = document.getElementById("table-admin-penilaian-body");
  const empty = document.getElementById("table-admin-penilaian-empty");
  if (!tbody) return;
  tbody.innerHTML = "";

  const evalGroup = {};
  evals.forEach((e) => {
    if (!evalGroup[e.proposalId]) {
      evalGroup[e.proposalId] = [];
    }
    evalGroup[e.proposalId].push(e);
  });

  const evaluatedProps = props.filter(
    (p) => evalGroup[p.id] && evalGroup[p.id].length > 0,
  );

  if (evaluatedProps.length === 0) {
    tbody.classList.add("hidden");
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");
  tbody.classList.remove("hidden");

  evaluatedProps.forEach((prop) => {
    const propEvals = evalGroup[prop.id];
    const avgScores = propEvals.map((e) => e.average);
    const overallAvg =
      avgScores.reduce((sum, val) => sum + val, 0) / avgScores.length;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-white/5 transition-colors border-b border-white/5";
    tr.innerHTML = `
      <td class="px-6 py-4 font-semibold text-white truncate max-w-xs">${prop.title}</td>
      <td class="px-6 py-4">${prop.fullName || prop.authorEmail}</td>
      <td class="px-6 py-4 font-mono font-bold text-indigo-400 text-base">${overallAvg.toFixed(2)}</td>
      <td class="px-6 py-4 text-right text-xs">
        <div class="flex items-center justify-end gap-2">
          <button class="btn-show-juri-eval px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/25 border border-indigo-500/20 text-indigo-400 hover:text-white transition-all text-[11px] font-bold" title="Tampilkan Evaluasi Juri">
            Tampilkan Evaluasi Juri
          </button>
          <button class="btn-view-eval p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors" title="Lihat Detail Proposal">
            <i data-lucide="eye" class="w-4.5 h-4.5"></i>
          </button>
        </div>
      </td>
    `;

    tr.querySelector(".btn-show-juri-eval").addEventListener("click", () =>
      openAdminJuriEvaluationsModal(prop, propEvals),
    );
    tr.querySelector(".btn-view-eval").addEventListener("click", () =>
      showProposalDetail(prop.id),
    );
    tbody.appendChild(tr);
  });
  refreshIcons();
}

function openAdminJuriEvaluationsModal(prop, propEvals) {
  const modal = document.getElementById("modal-admin-juri-evaluations");
  const subtitle = document.getElementById("eval-modal-subtitle");
  const content = document.getElementById("eval-modal-content");

  if (!modal || !subtitle || !content) return;

  subtitle.textContent = prop.title;

  content.innerHTML = propEvals
    .map(
      (e) => `
    <div class="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4">
      <div class="flex justify-between items-center border-b border-white/5 pb-3">
        <div>
          <span class="text-[10px] text-slate-400 font-semibold uppercase block">Nama Juri</span>
          <strong class="text-sm text-white">${e.juriName}</strong>
        </div>
        <div class="text-right">
          <span class="text-[10px] text-slate-400 font-semibold uppercase block font-mono">Nilai Rata-rata</span>
          <strong class="text-base text-indigo-400 font-extrabold font-mono">${e.average.toFixed(2)}</strong>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div class="bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
          <span class="text-[9px] text-slate-500 uppercase block font-semibold font-mono">Orisinalitas</span>
          <strong class="text-sm text-slate-200">${e.scores?.orisinalitas || 0}</strong>
        </div>
        <div class="bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
          <span class="text-[9px] text-slate-500 uppercase block font-semibold font-mono">Penerapan</span>
          <strong class="text-sm text-slate-200">${e.scores?.penerapan || 0}</strong>
        </div>
        <div class="bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
          <span class="text-[9px] text-slate-500 uppercase block font-semibold font-mono">Manfaat</span>
          <strong class="text-sm text-slate-200">${e.scores?.manfaat || 0}</strong>
        </div>
        <div class="bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
          <span class="text-[9px] text-slate-500 uppercase block font-semibold font-mono">Keberlangsungan</span>
          <strong class="text-sm text-slate-200">${e.scores?.keberlangsungan || 0}</strong>
        </div>
      </div>

      <div class="bg-slate-900/30 p-3.5 rounded-xl border border-white/5 text-xs text-slate-300">
        <span class="font-bold text-slate-400 block mb-1">Catatan Evaluasi:</span>
        <p class="italic leading-relaxed">"${e.comment || "Tidak ada catatan."}"</p>
      </div>
    </div>
  `,
    )
    .join("");

  refreshIcons();
  modal.showModal();
}

async function loadAdminUsers() {
  const users = await listAllUsers();
  renderAdminUsersTable(users, activeUserFilter);
}

function renderAdminUsersTable(users, filter = "all") {
  const tbody = document.getElementById("table-admin-users-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filtered =
    filter === "all"
      ? users
      : users.filter(
          (u) =>
            (u.role || "peserta").trim().toLowerCase() ===
            filter.trim().toLowerCase(),
        );

  filtered.forEach((user) => {
    const dateStr = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString("id-ID")
      : "-";
    let roleBadge =
      "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
    if (user.role === "admin")
      roleBadge = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    if (user.role === "juri")
      roleBadge = "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";

    const tr = document.createElement("tr");
    tr.className = "hover:bg-white/5 transition-colors border-b border-white/5";
    tr.innerHTML = `
      <td class="px-6 py-4 font-semibold text-white">${user.fullName || user.email.split("@")[0]}</td>
      <td class="px-6 py-4 font-mono text-xs">${user.email}</td>
      <td class="px-6 py-4">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${roleBadge}">
          ${user.role}
        </span>
      </td>
      <td class="px-6 py-4 font-mono text-xs text-slate-500">${dateStr}</td>
      <td class="px-6 py-4 text-right text-xs">
        <div class="flex items-center justify-end gap-2">
          <button class="btn-edit-user p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors" title="Edit User">
            <i data-lucide="edit-3" class="w-4 h-4"></i>
          </button>
          ${
            currentUser.uid !== user.uid
              ? `
            <button class="btn-delete-user p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors" title="Hapus User">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          `
              : '<span class="text-slate-500 font-medium">Akun Anda</span>'
          }
        </div>
      </td>
    `;

    const btnEdit = tr.querySelector(".btn-edit-user");
    if (btnEdit) {
      btnEdit.addEventListener("click", () => openUserModal(user));
    }

    const btnDel = tr.querySelector(".btn-delete-user");
    if (btnDel) {
      btnDel.addEventListener("click", async () => {
        if (
          confirm(
            `Apakah Anda yakin ingin menghapus akun ${user.fullName || user.email}?`,
          )
        ) {
          showLoading("Menghapus user...");
          try {
            await deleteUserProfile(user.uid);
            showToast("Akun user berhasil dihapus.", "success");
            await loadAdminUsers();
          } catch (e) {
            showToast(formatDbError(e), "error");
          } finally {
            hideLoading();
          }
        }
      });
    }

    tbody.appendChild(tr);
  });
  refreshIcons();
}

const formSchedule = document.getElementById("form-schedule-settings");
if (formSchedule) {
  formSchedule.addEventListener("submit", async (e) => {
    e.preventDefault();
    const entryStart = document.getElementById("schedule-entry-start").value;
    const entryEnd = document.getElementById("schedule-entry-end").value;
    const evalStart = document.getElementById("schedule-eval-start").value;
    const evalEnd = document.getElementById("schedule-eval-end").value;

    showLoading("Menyimpan jadwal...");
    const pollActive = document.getElementById("schedule-poll-active")?.checked || false;
    const pollStart = document.getElementById("schedule-poll-start")?.value || "";
    const pollEnd = document.getElementById("schedule-poll-end")?.value || "";

    try {
      await saveSystemConfig("schedule", {
        entry_start: entryStart,
        entry_end: entryEnd,
        eval_start: evalStart,
        eval_end: evalEnd,
        poll_active: pollActive,
        poll_start: pollStart,
        poll_end: pollEnd
      });
      showToast("Jadwal pelaksanaan berhasil disimpan.", "success");
      await loadScheduleConfig();
    } catch (err) {
      showToast(formatDbError(err), "error");
    } finally {
      hideLoading();
    }
  });
}

// ----------------------------------------------------
// MULTI-STEP PROPOSAL WIZARD FORM LOGIC
// ----------------------------------------------------
if (btnCreateProposal) {
  btnCreateProposal.addEventListener("click", async () => {
    startProposalWizard();
  });
}

btnCancelWizard.addEventListener("click", () => {
  if (
    confirm(
      "Anda yakin ingin membatalkan? Perubahan yang belum disimpan akan hilang.",
    )
  ) {
    showSection("section-dashboard");
  }
});

btnWizardPrev.addEventListener("click", () => {
  if (currentStep > 1) {
    currentStep--;
    updateWizardUI();
  }
});

btnWizardNext.addEventListener("click", async () => {
  if (validateStep(currentStep)) {
    if (currentStep < 5) {
      currentStep++;
      updateWizardUI();
    } else {
      await submitWizardForm(false);
    }
  }
});

btnSaveDraft.addEventListener("click", async () => {
  const title = document.getElementById("field-title").value.trim();
  if (!title) {
    showToast(
      "Isi minimal Judul Proposal (Langkah 2) untuk menyimpan sebagai draf!",
      "warning",
    );
    currentStep = 2;
    updateWizardUI();
    document.getElementById("field-title").focus();
    return;
  }
  await submitWizardForm(true);
});

stepDots.forEach((dot) => {
  dot.addEventListener("click", () => {
    const target = parseInt(dot.getAttribute("data-step"));
    if (target < currentStep) {
      currentStep = target;
      updateWizardUI();
    } else if (target > currentStep) {
      let canAdvance = true;
      for (let s = currentStep; s < target; s++) {
        if (!validateStep(s)) {
          canAdvance = false;
          currentStep = s;
          updateWizardUI();
          break;
        }
      }
      if (canAdvance) {
        currentStep = target;
        updateWizardUI();
      }
    }
  });
});

async function populateBidangDropdown() {
  const dropdown = document.getElementById("field-bidang");
  if (!dropdown) return;
  try {
    const list = await getBidangLomba();
    dropdown.innerHTML = `<option value="" disabled selected>Pilih Bidang Lomba</option>`;
    list.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.nama;
      opt.textContent = b.nama;
      dropdown.appendChild(opt);
    });
  } catch (e) {
    console.error("Gagal memuat bidang:", e);
  }
}

const selectStatusTim = document.getElementById("field-status-tim");
const containerAnggotaTim = document.getElementById("container-anggota-tim");
if (selectStatusTim && containerAnggotaTim) {
  selectStatusTim.addEventListener("change", () => {
    if (selectStatusTim.value === "Kelompok") {
      containerAnggotaTim.classList.remove("hidden");
    } else {
      containerAnggotaTim.classList.add("hidden");
      document.getElementById("field-anggota1").value = "";
      document.getElementById("field-anggota2").value = "";
      document.getElementById("field-anggota3").value = "";
      document.getElementById("field-anggota4").value = "";
    }
  });
}

function updateWizardUI() {
  document.querySelectorAll(".wizard-step-content").forEach((content) => {
    content.classList.add("hidden");
  });
  document
    .getElementById(`step-content-${currentStep}`)
    .classList.remove("hidden");

  const pct = ((currentStep - 1) / 4) * 100;
  wizardProgressBar.style.width = pct + "%";

  stepDots.forEach((dot) => {
    const stepNum = parseInt(dot.getAttribute("data-step"));
    dot.className =
      "step-dot w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm cursor-pointer ";
    if (stepNum === currentStep) {
      dot.className += "active text-white bg-indigo-600";
    } else if (stepNum < currentStep) {
      dot.className += "completed text-white bg-emerald-500";
    } else {
      dot.className += "bg-slate-800 text-slate-400";
    }
  });

  btnWizardPrev.disabled = currentStep === 1;

  if (currentStep === 5) {
    document.getElementById("review-summary-title").textContent =
      document.getElementById("field-title").value.trim() || "(Belum Terisi)";
    document.getElementById("review-summary-category").textContent =
      document.getElementById("field-bidang").value || "(Belum Terpilih)";

    btnWizardNext.innerHTML = `<span>Kirim Proposal Lomba</span><i data-lucide="send" class="w-4 h-4"></i>`;
    btnWizardNext.className =
      "w-full sm:w-auto px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/10 active:scale-98 transition-all flex items-center justify-center gap-2";

    if (window.L) {
      setTimeout(() => {
        if (!wizardMap) {
          const defaultLat =
            parseFloat(document.getElementById("field-latitude").value) ||
            -7.4797;
          const defaultLng =
            parseFloat(document.getElementById("field-longitude").value) ||
            110.2185;

          wizardMap = L.map("wizard-map").setView([defaultLat, defaultLng], 13);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(wizardMap);

          wizardMarker = L.marker([defaultLat, defaultLng], {
            draggable: true,
          }).addTo(wizardMap);

          wizardMarker.on("dragend", function () {
            const pos = wizardMarker.getLatLng();
            document.getElementById("field-latitude").value =
              pos.lat.toFixed(6);
            document.getElementById("field-longitude").value =
              pos.lng.toFixed(6);
          });

          wizardMap.on("click", function (e) {
            wizardMarker.setLatLng(e.latlng);
            document.getElementById("field-latitude").value =
              e.latlng.lat.toFixed(6);
            document.getElementById("field-longitude").value =
              e.latlng.lng.toFixed(6);
          });

          document.getElementById("field-latitude").value =
            defaultLat.toFixed(6);
          document.getElementById("field-longitude").value =
            defaultLng.toFixed(6);
        } else {
          wizardMap.invalidateSize();
          const lat =
            parseFloat(document.getElementById("field-latitude").value) ||
            -7.4797;
          const lng =
            parseFloat(document.getElementById("field-longitude").value) ||
            110.2185;
          wizardMap.setView([lat, lng], 13);
          wizardMarker.setLatLng([lat, lng]);
        }
      }, 200);
    }
  } else {
    btnWizardNext.innerHTML = `<span>Lanjut</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    btnWizardNext.className =
      "w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/10 active:scale-98 transition-all flex items-center justify-center gap-2";
  }

  refreshIcons();
}

function validateStep(step) {
  if (step === 1) {
    const tahun = document.getElementById("field-tahun").value.trim();
    const namaEmail = document.getElementById("field-nama-email").value.trim();
    const fullname = document.getElementById("field-fullname").value.trim();
    const phone = document.getElementById("field-phone").value.trim();
    const address = document.getElementById("field-address").value.trim();

    if (!tahun || !namaEmail || !fullname || !phone || !address) {
      showToast(
        "Lengkapi seluruh form data diri (Tahun, Nama Email, Nama Inovator, No. HP, Alamat)!",
        "warning",
      );
      return false;
    }
  }

  if (step === 2) {
    const title = document.getElementById("field-title").value.trim();
    const bidang = document.getElementById("field-bidang").value;
    const description = document
      .getElementById("field-description")
      .value.trim();

    if (!title || !bidang || !description) {
      showToast(
        "Lengkapi Judul, Bidang, dan Deskripsi inovasi Anda!",
        "warning",
      );
      return false;
    }
  }

  if (step === 3) {
    const requiredFields = [
      "abstrak",
      "background",
      "objectives",
      "benefits",
      "keunggulan",
      "aspek",
      "penerapan",
      "budget",
    ];
    const emptyFields = requiredFields.filter((id) => !getEditorHTML(id));
    if (emptyFields.length > 0) {
      showToast(
        "Lengkapi semua isi materi proposal (Abstrak, Latar Belakang, Maksud dan Tujuan, Manfaat, Keunggulan, Aspek, Penerapan, Anggaran)!",
        "warning",
      );
      return false;
    }
  }

  if (step === 4) {
    const qFields = [
      "field-q-orisinalitas1",
      "field-q-orisinalitas2",
      "field-q-orisinalitas3",
      "field-q-penerapan1",
      "field-q-penerapan2",
      "field-q-manfaat1",
      "field-q-manfaat2",
      "field-q-manfaat3",
      "field-q-manfaat4",
      "field-q-manfaat5",
      "field-q-keberlangsungan1",
      "field-q-keberlangsungan2",
    ];
    const empty = qFields.filter((id) => {
      const el = document.getElementById(id);
      return el ? !el.value.trim() : true;
    });
    if (empty.length > 0) {
      showToast("Harap isi semua pertanyaan kuesioner langkah 4!", "warning");
      return false;
    }
  }

  if (step === 5) {
    const lat = document.getElementById("field-latitude").value;
    const lng = document.getElementById("field-longitude").value;

    if (!lat || !lng) {
      showToast("Harap tentukan lokasi inovasi Anda pada Peta!", "warning");
      return false;
    }
  }

  return true;
}

async function startProposalWizard() {
  if (currentUser && currentUser.role === "peserta") {
    const check = await checkRegistrationActive();
    if (!check.active) {
      showToast(check.reason, "error");
      return;
    }
  }
  if (!currentUser) return;

  wizardForm.reset();
  document.getElementById("field-proposal-id").value = "";

  document.getElementById("field-tahun").value = "2026";
  document.getElementById("field-email").value = currentUser.email;
  document.getElementById("field-nama-email").value =
    currentUser.fullName || currentUser.email.split("@")[0];
  document.getElementById("field-fullname").value = currentUser.fullName || "";

  await populateBidangDropdown();

  editorIds.forEach((id) => {
    if (editors[id]) {
      editors[id].setContents([]);
    }
  });

  resetFileUploadZone("photo");
  resetFileUploadZone("identity");
  resetFileUploadZone("originality");
  resetFileUploadZone("approval");
  uploadedProductPhotos = [];
  document.getElementById("field-products-urls").value = "[]";
  renderProductPreviews();

  document.getElementById("field-latitude").value = "";
  document.getElementById("field-longitude").value = "";

  const containerAnggotaTim = document.getElementById("container-anggota-tim");
  if (containerAnggotaTim) containerAnggotaTim.classList.add("hidden");

  currentStep = 1;
  updateWizardUI();

  document.getElementById("form-wizard-title").textContent =
    "Entry Proposal Inovasi Baru";
  showSection("section-form");
}

async function submitWizardForm(isDraft = false) {
  if (currentUser && currentUser.role === "peserta") {
    const check = await checkRegistrationActive();
    if (!check.active) {
      showToast(check.reason, "error");
      return;
    }
  }
  if (!currentUser) return;

  const statusMsg = isDraft
    ? "Menyimpan draf proposal..."
    : "Mengirim proposal ke panitia...";
  showLoading(statusMsg);

  const proposalData = {
    id: document.getElementById("field-proposal-id").value || null,
    userId: currentUser.uid,
    authorEmail: currentUser.email,
    tahun: parseInt(document.getElementById("field-tahun").value) || 2026,
    namaEmail: document.getElementById("field-nama-email").value.trim(),
    fullName: document.getElementById("field-fullname").value.trim(),
    phone: document.getElementById("field-phone").value.trim(),
    address: document.getElementById("field-address").value.trim(),
    kategoriPengusul: document.getElementById("field-kategori-pengusul").value,
    statusTim: document.getElementById("field-status-tim").value,
    anggota: [
      document.getElementById("field-anggota1").value.trim(),
      document.getElementById("field-anggota2").value.trim(),
      document.getElementById("field-anggota3").value.trim(),
      document.getElementById("field-anggota4").value.trim(),
    ].filter((name) => name !== ""),

    title: document.getElementById("field-title").value.trim(),
    bidang: document.getElementById("field-bidang").value,
    jenisInovasi: document.getElementById("field-jenis-inovasi").value,
    tahapInovasi: document.getElementById("field-tahap-inovasi").value,
    description: document.getElementById("field-description").value.trim(),

    proposalContent: {
      abstrak: getEditorHTML("abstrak"),
      background: getEditorHTML("background"),
      objectives: getEditorHTML("objectives"),
      benefits: getEditorHTML("benefits"),
      keunggulan: getEditorHTML("keunggulan"),
      aspek: getEditorHTML("aspek"),
      penerapan: getEditorHTML("penerapan"),
      budget: getEditorHTML("budget"),
    },

    questionnaire: {
      orisinalitas1: document
        .getElementById("field-q-orisinalitas1")
        .value.trim(),
      orisinalitas2: document
        .getElementById("field-q-orisinalitas2")
        .value.trim(),
      orisinalitas3: document
        .getElementById("field-q-orisinalitas3")
        .value.trim(),
      penerapan1: document.getElementById("field-q-penerapan1").value.trim(),
      penerapan2: document.getElementById("field-q-penerapan2").value.trim(),
      penerapan3: document.getElementById("field-q-penerapan3").value,
      manfaat1: document.getElementById("field-q-manfaat1").value.trim(),
      manfaat2: document.getElementById("field-q-manfaat2").value.trim(),
      manfaat3: document.getElementById("field-q-manfaat3").value.trim(),
      manfaat4: document.getElementById("field-q-manfaat4").value.trim(),
      manfaat5: document.getElementById("field-q-manfaat5").value.trim(),
      keberlangsungan1: document
        .getElementById("field-q-keberlangsungan1")
        .value.trim(),
      keberlangsungan2: document
        .getElementById("field-q-keberlangsungan2")
        .value.trim(),
    },

    latitude:
      parseFloat(document.getElementById("field-latitude").value) || null,
    longitude:
      parseFloat(document.getElementById("field-longitude").value) || null,
    videoUrl: document.getElementById("field-video-url").value.trim(),
    teamPhotoUrl: document.getElementById("field-photo-url").value,
    identityDocUrl: document.getElementById("field-identity-url").value,
    originalityDocUrl: document.getElementById("field-originality-url").value,
    approvalDocUrl: document.getElementById("field-approval-url").value,
    productPhotosUrls: JSON.parse(
      document.getElementById("field-products-urls").value || "[]",
    ),
  };

  try {
    await saveProposal(proposalData, isDraft);
    showToast(
      isDraft
        ? "Draf proposal berhasil disimpan."
        : "Proposal berhasil dikirim ke panitia!",
      "success",
    );
    showSection("section-dashboard");
    // Reload active dashboard panel data
    if (currentUser.role === "peserta") {
      await loadPesertaProposals();
    } else if (currentUser.role === "admin") {
      await loadAdminProposals();
    }
  } catch (error) {
    showToast(formatDbError(error), "error");
  } finally {
    hideLoading();
  }
}

// ----------------------------------------------------
// FILE UPLOAD TRIGGERS (Drag & Drop + Inputs)
// ----------------------------------------------------
setupFileDropzone(
  "photo",
  2 * 1024 * 1024,
  "image/png, image/jpeg",
  "team_photo",
);
setupFileDropzone(
  "identity",
  5 * 1024 * 1024,
  "application/pdf",
  "identitas.pdf",
);
setupFileDropzone(
  "originality",
  5 * 1024 * 1024,
  "application/pdf",
  "orisinalitas.pdf",
);
setupFileDropzone(
  "approval",
  5 * 1024 * 1024,
  "application/pdf",
  "pengesahan.pdf",
);
setupProductPhotosDropzone();

function setupFileDropzone(type, maxSize, allowedTypes, storageFilename) {
  const dropzone = document.getElementById(`dropzone-${type}`);
  const input = document.getElementById(`upload-${type}-input`);
  const infoState = document.getElementById(`${type}-dropzone-info`);
  const previewState = document.getElementById(`${type}-preview-container`);
  const previewFilename = document.getElementById(`${type}-preview-filename`);
  const progressContainer = document.getElementById(
    `${type}-upload-progress-container`,
  );
  const progressBar = document.getElementById(`${type}-upload-progress-bar`);
  const btnRemove = document.getElementById(`btn-remove-${type}`);

  if (!dropzone || !input) return;

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  input.addEventListener("change", () => {
    const files = input.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  if (btnRemove) {
    btnRemove.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      resetFileUploadZone(type);
    });
  }

  async function handleFileUpload(file) {
    const mimeMatch = allowedTypes
      .split(",")
      .map((t) => t.trim())
      .some((allowed) => {
        if (allowed === "application/pdf")
          return file.type === "application/pdf";
        if (allowed.startsWith("image/")) return file.type.startsWith("image/");
        return false;
      });

    if (!mimeMatch) {
      showToast(
        `Format berkas tidak didukung! Harus berupa: ${type === "photo" ? "JPG/PNG" : "PDF"}`,
        "error",
      );
      return;
    }

    if (file.size > maxSize) {
      showToast(
        `Ukuran berkas melebihi batas maksimum (${Math.round(maxSize / (1024 * 1024))} MB)!`,
        "error",
      );
      return;
    }

    if (infoState) infoState.classList.add("hidden");
    if (previewState) previewState.classList.remove("hidden");
    if (previewFilename) previewFilename.textContent = file.name;

    const sizeDisplay = document.getElementById(`${type}-preview-filesize`);
    if (sizeDisplay) {
      sizeDisplay.textContent = `${Math.round(file.size / 1024)} KB`;
    }

    if (progressContainer) {
      progressContainer.classList.remove("hidden");
    }
    if (progressBar) {
      progressBar.style.width = "0%";
    }

    if (type === "photo") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewImg = document.getElementById("photo-preview-img");
        if (previewImg) previewImg.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    const userId = currentUser ? currentUser.uid : "visitor";
    const path = `proposals/${userId}/${Date.now()}_${storageFilename}`;

    try {
      const downloadUrl = await uploadFile(file, path, (percent) => {
        if (progressBar) progressBar.style.width = percent + "%";
      });

      document.getElementById(`field-${type}-url`).value = downloadUrl;
      showToast(`Berkas ${file.name} berhasil diunggah!`, "success");

      if (progressContainer) {
        setTimeout(() => progressContainer.classList.add("hidden"), 500);
      }
    } catch (error) {
      showToast(`Gagal mengunggah berkas ${file.name}.`, "error");
      resetFileUploadZone(type);
    }
  }
}

function setupProductPhotosDropzone() {
  const dropzone = document.getElementById("dropzone-products");
  const input = document.getElementById("upload-products-input");
  const infoState = document.getElementById("products-dropzone-info");

  if (!dropzone || !input) return;

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    handleProductFiles(e.dataTransfer.files);
  });

  input.addEventListener("change", () => {
    handleProductFiles(input.files);
  });

  async function handleProductFiles(files) {
    if (uploadedProductPhotos.length + files.length > 5) {
      showToast(
        "Maksimal 5 foto produk/inovasi saja yang diizinkan!",
        "warning",
      );
      return;
    }

    showLoading("Mengunggah foto produk...");
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          showToast(
            `Format berkas ${file.name} tidak didukung! Harus berupa JPG/PNG.`,
            "error",
          );
          continue;
        }
        if (file.size > 2 * 1024 * 1024) {
          showToast(`Ukuran berkas ${file.name} melebihi batas 2 MB!`, "error");
          continue;
        }

        const path = `proposals/${currentUser ? currentUser.uid : "visitor"}/${Date.now()}_prod_${file.name}`;
        const url = await uploadFile(file, path);
        uploadedProductPhotos.push(url);
      }
      document.getElementById("field-products-urls").value = JSON.stringify(
        uploadedProductPhotos,
      );
      renderProductPreviews();
      showToast("Foto produk berhasil diunggah!", "success");
    } catch (e) {
      showToast("Gagal mengunggah beberapa foto produk.", "error");
    } finally {
      hideLoading();
    }
  }
}

function renderProductPreviews() {
  const previewList = document.getElementById("products-preview-list");
  const infoState = document.getElementById("products-dropzone-info");
  if (!previewList) return;

  if (uploadedProductPhotos.length === 0) {
    previewList.classList.add("hidden");
    if (infoState) infoState.classList.remove("hidden");
    return;
  }

  previewList.classList.remove("hidden");
  if (infoState) infoState.classList.add("hidden");
  previewList.innerHTML = "";

  uploadedProductPhotos.forEach((url, idx) => {
    const item = document.createElement("div");
    item.className =
      "relative group rounded-lg overflow-hidden border border-white/10 aspect-square";
    item.innerHTML = `
      <img src="${url}" class="w-full h-full object-cover">
      <button type="button" class="absolute inset-0 bg-red-600/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-semibold" onclick="removeProductPhoto(${idx})">
        Hapus
      </button>
    `;
    previewList.appendChild(item);
  });
}

window.removeProductPhoto = (idx) => {
  uploadedProductPhotos.splice(idx, 1);
  document.getElementById("field-products-urls").value = JSON.stringify(
    uploadedProductPhotos,
  );
  renderProductPreviews();
};

function resetFileUploadZone(type) {
  const infoState = document.getElementById(`${type}-dropzone-info`);
  const previewState = document.getElementById(`${type}-preview-container`);
  const input = document.getElementById(`upload-${type}-input`);
  const fieldUrl = document.getElementById(`field-${type}-url`);

  if (input) input.value = "";
  if (fieldUrl) fieldUrl.value = "";

  if (infoState && previewState) {
    infoState.classList.remove("hidden");
    previewState.classList.add("hidden");
  }
}

// ----------------------------------------------------
// DETAILED VIEW MODAL
// ----------------------------------------------------
let detailMap = null;
let detailMarker = null;

function renderDetailMap(lat, lng) {
  if (!window.L) return;
  const mapContainer = document.getElementById("detail-map");
  if (!mapContainer) return;

  setTimeout(() => {
    if (!detailMap) {
      detailMap = L.map("detail-map").setView([lat, lng], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(detailMap);
      detailMarker = L.marker([lat, lng]).addTo(detailMap);
    } else {
      detailMap.invalidateSize();
      detailMap.setView([lat, lng], 14);
      detailMarker.setLatLng([lat, lng]);
    }
  }, 300);
}

async function showProposalDetail(id) {
  showLoading("Memuat detail proposal...");
  try {
    const prop = await getProposalById(id);
    if (!prop) {
      showToast("Data proposal tidak ditemukan.", "error");
      return;
    }
    activeDetailProposal = prop;

    // Set active tab to Overview on open
    const tabOverview = document.getElementById("tab-det-overview");
    if (tabOverview) {
      tabOverview.click();
    }

    // Populate text details
    document.getElementById("detail-uuid").textContent = prop.id;
    document.getElementById("detail-title").textContent = prop.title;
    document.getElementById("detail-description").textContent =
      prop.description;

    const elCategory = document.getElementById("detail-category");
    if (elCategory) elCategory.textContent = prop.bidang || prop.category;

    const elTahun = document.getElementById("detail-tahun");
    if (elTahun) elTahun.textContent = prop.tahun || 2026;

    const elJenis = document.getElementById("detail-jenis");
    if (elJenis) elJenis.textContent = prop.jenisInovasi || "Digital";

    const elTahap = document.getElementById("detail-tahap");
    if (elTahap) elTahap.textContent = prop.tahapInovasi || "Uji Coba";

    document.getElementById("detail-fullname").textContent = prop.fullName;
    document.getElementById("detail-email").textContent = prop.authorEmail;
    document.getElementById("detail-phone").textContent = prop.phone;

    const elKategoriPengusul = document.getElementById(
      "detail-kategori-pengusul",
    );
    if (elKategoriPengusul)
      elKategoriPengusul.textContent = prop.kategoriPengusul || "Pelajar";

    // Team Members
    const elMembersContainer = document.getElementById(
      "detail-team-members-container",
    );
    const elMembersList = document.getElementById("detail-team-members");
    if (elMembersContainer && elMembersList) {
      if (
        prop.statusTim === "Kelompok" &&
        prop.anggota &&
        prop.anggota.length > 0
      ) {
        elMembersContainer.classList.remove("hidden");
        elMembersList.innerHTML = prop.anggota
          .map(
            (m) => `
          <li class="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 truncate">
            <i data-lucide="user" class="w-3.5 h-3.5 text-indigo-400"></i>
            <span class="truncate">${m}</span>
          </li>
        `,
          )
          .join("");
      } else {
        elMembersContainer.classList.add("hidden");
        elMembersList.innerHTML = "";
      }
    }

    // Coordinates & Map
    const elLatTxt = document.getElementById("detail-lat-txt");
    const elLngTxt = document.getElementById("detail-lng-txt");
    if (elLatTxt && elLngTxt) {
      if (prop.latitude && prop.longitude) {
        elLatTxt.textContent = prop.latitude.toFixed(6);
        elLngTxt.textContent = prop.longitude.toFixed(6);
        renderDetailMap(prop.latitude, prop.longitude);
      } else {
        elLatTxt.textContent = "-";
        elLngTxt.textContent = "-";
      }
    }

    // Team Photo image
    const photoImg = document.getElementById("detail-team-photo");
    if (photoImg) {
      if (prop.teamPhotoUrl) {
        photoImg.src = prop.teamPhotoUrl;
        photoImg.classList.remove("hidden");
      } else {
        photoImg.src =
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256";
        photoImg.classList.remove("hidden");
      }
    }

    // PDF Documents links
    const dlIdentity = document.getElementById("detail-download-identity");
    const dlOriginality = document.getElementById(
      "detail-download-originality",
    );
    const dlApproval = document.getElementById("detail-download-approval");

    if (dlIdentity) dlIdentity.href = prop.identityDocUrl || "#";
    if (dlOriginality) dlOriginality.href = prop.originalityDocUrl || "#";
    if (dlApproval) dlApproval.href = prop.approvalDocUrl || "#";

    // Status Badge classes
    const statusBadge = document.getElementById("detail-status");
    statusBadge.textContent = prop.status;
    statusBadge.className =
      "px-2.5 py-1 rounded-full text-xs font-mono font-bold ";
    if (prop.status === "Draft")
      statusBadge.className +=
        "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    if (prop.status === "Submitted")
      statusBadge.className +=
        "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
    if (prop.status === "Under Review")
      statusBadge.className +=
        "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
    if (prop.status === "Approved" || prop.status === "Accepted")
      statusBadge.className +=
        "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    if (prop.status === "Rejected")
      statusBadge.className +=
        "bg-red-500/10 text-red-400 border border-red-500/20";

    // Render Edit and Delete action controls (Draft ONLY, for Peserta or Admin)
    const canManageDraft =
      prop.status === "Draft" &&
      (currentUser.role === "peserta" || currentUser.role === "admin");
    if (canManageDraft) {
      btnDetailEdit.classList.remove("hidden");
      btnDetailDelete.classList.remove("hidden");

      btnDetailEdit.onclick = async () => {
        if (currentUser && currentUser.role === "peserta") {
          const check = await checkRegistrationActive();
          if (!check.active) {
            showToast(check.reason, "error");
            return;
          }
        }
        modalDetail.close();
        editProposalDraft(prop);
      };

      btnDetailDelete.onclick = async () => {
        if (
          confirm(
            "Apakah Anda yakin ingin menghapus draf proposal ini secara permanen?",
          )
        ) {
          modalDetail.close();
          showLoading("Menghapus draf...");
          try {
            await deleteProposal(prop.id);
            showToast("Draf proposal berhasil dihapus.", "success");
            if (currentUser.role === "peserta") {
              await loadPesertaProposals();
            } else if (currentUser.role === "admin") {
              await loadAdminProposals();
            }
          } catch (e) {
            showToast(formatDbError(e), "error");
          } finally {
            hideLoading();
          }
        }
      };
    } else {
      btnDetailEdit.classList.add("hidden");
      btnDetailDelete.classList.add("hidden");
    }

    // Video Link
    const elVideoLink = document.getElementById("detail-video-link");
    const elVideoContainer = document.getElementById("detail-video-container");
    const elVideoText = document.getElementById("detail-video-text");
    if (elVideoContainer && elVideoLink && elVideoText) {
      if (prop.videoUrl) {
        elVideoContainer.classList.remove("hidden");
        elVideoLink.href = prop.videoUrl;
        elVideoText.textContent = "Link Video Tersedia";
      } else {
        elVideoLink.href = "#";
        elVideoText.textContent = "Video tidak dilampirkan";
      }
    }

    // Populate Substance Panels
    const content = prop.proposalContent || {};
    document.getElementById("detail-abstrak").innerHTML =
      content.abstrak || "Tidak ada konten.";
    document.getElementById("detail-background").innerHTML =
      content.background || "Tidak ada konten.";
    document.getElementById("detail-objectives").innerHTML =
      content.objectives || "Tidak ada konten.";
    document.getElementById("detail-benefits").innerHTML =
      content.benefits || "Tidak ada konten.";
    document.getElementById("detail-keunggulan").innerHTML =
      content.keunggulan || "Tidak ada konten.";
    document.getElementById("detail-aspek").innerHTML =
      content.aspek || "Tidak ada konten.";
    document.getElementById("detail-penerapan").innerHTML =
      content.penerapan || "Tidak ada konten.";
    document.getElementById("detail-budget").innerHTML =
      content.budget || "Tidak ada konten.";

    // Populate Questionnaire Panel
    const q = prop.questionnaire || {};
    document.getElementById("det-q-orisinalitas1").textContent =
      q.orisinalitas1 || "-";
    document.getElementById("det-q-orisinalitas2").textContent =
      q.orisinalitas2 || "-";
    document.getElementById("det-q-orisinalitas3").textContent =
      q.orisinalitas3 || "-";
    document.getElementById("det-q-penerapan1").textContent =
      q.penerapan1 || "-";
    document.getElementById("det-q-penerapan2").textContent =
      q.penerapan2 || "-";
    document.getElementById("det-q-penerapan3").textContent =
      q.penerapan3 || "-";
    document.getElementById("det-q-manfaat1").textContent = q.manfaat1 || "-";
    document.getElementById("det-q-manfaat2").textContent = q.manfaat2 || "-";
    document.getElementById("det-q-manfaat3").textContent = q.manfaat3 || "-";
    document.getElementById("det-q-manfaat4").textContent = q.manfaat4 || "-";
    document.getElementById("det-q-manfaat5").textContent = q.manfaat5 || "-";
    document.getElementById("det-q-keberlangsungan1").textContent =
      q.keberlangsungan1 || "-";
    document.getElementById("det-q-keberlangsungan2").textContent =
      q.keberlangsungan2 || "-";

    // Product Gallery
    const galleryGrid = document.getElementById("detail-product-photos-grid");
    const galleryEmpty = document.getElementById("detail-product-photos-empty");
    if (galleryGrid && galleryEmpty) {
      galleryGrid.innerHTML = "";
      if (prop.productPhotosUrls && prop.productPhotosUrls.length > 0) {
        galleryEmpty.classList.add("hidden");
        galleryGrid.classList.remove("hidden");
        prop.productPhotosUrls.forEach((url) => {
          const a = document.createElement("a");
          a.href = url;
          a.target = "_blank";
          a.className =
            "block rounded-lg overflow-hidden border border-white/5 aspect-square bg-white/5 hover:border-indigo-500/30 transition-all";
          a.innerHTML = `<img src="${url}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300">`;
          galleryGrid.appendChild(a);
        });
      } else {
        galleryGrid.classList.add("hidden");
        galleryEmpty.classList.remove("hidden");
      }
    }

    // Juri Ratings Summary inside detail modal
    const elJuriSummary = document.getElementById("detail-juri-scores-summary");
    if (elJuriSummary) {
      if (
        (currentUser && currentUser.role === "peserta") ||
        (currentUser && currentUser.role === "juri")
      ) {
        elJuriSummary.classList.add("hidden");
      } else {
        try {
          const evals = await getProposalEvaluations(prop.id);
          if (evals && evals.length > 0) {
            elJuriSummary.classList.remove("hidden");

            const sumOrisinalitas = evals.reduce(
              (sum, e) => sum + e.scores.orisinalitas,
              0,
            );
            const sumPenerapan = evals.reduce(
              (sum, e) => sum + e.scores.penerapan,
              0,
            );
            const sumManfaat = evals.reduce(
              (sum, e) => sum + e.scores.manfaat,
              0,
            );
            const sumKeberlangsungan = evals.reduce(
              (sum, e) => sum + e.scores.keberlangsungan,
              0,
            );
            const sumAvg = evals.reduce((sum, e) => sum + e.average, 0);
            const count = evals.length;

            document.getElementById("det-score-orisinalitas").textContent = (
              sumOrisinalitas / count
            ).toFixed(1);
            document.getElementById("det-score-penerapan").textContent = (
              sumPenerapan / count
            ).toFixed(1);
            document.getElementById("det-score-manfaat").textContent = (
              sumManfaat / count
            ).toFixed(1);
            document.getElementById("det-score-keberlangsungan").textContent = (
              sumKeberlangsungan / count
            ).toFixed(1);
            document.getElementById("det-score-avg").textContent = (
              sumAvg / count
            ).toFixed(2);

            const elComments = document.getElementById(
              "detail-comments-container",
            );
            if (elComments) {
              elComments.innerHTML = evals
                .map(
                  (e) => `
                <div class="border-b border-white/5 pb-1 mb-1 last:border-b-0">
                  <span class="font-bold text-slate-300 text-[11px]">${e.juriName}:</span>
                  <p class="italic text-[11px] text-slate-400 mt-0.5">"${e.comment || "Tidak ada catatan."}"</p>
                </div>
              `,
                )
                .join("");
            }
          } else {
            elJuriSummary.classList.add("hidden");
          }
        } catch (evalError) {
          console.warn(
            "Unable to fetch proposal evaluations (unauthorized or mock):",
            evalError,
          );
          elJuriSummary.classList.add("hidden");
        }
      }
    }

    // Toggle AI Tab visibility based on roles (only admin and juri can see AI Analysis)
    const tabAI = document.getElementById("tab-det-ai-analysis");
    if (tabAI) {
      if (
        currentUser &&
        (currentUser.role === "admin" || currentUser.role === "juri")
      ) {
        tabAI.classList.remove("hidden");
      } else {
        tabAI.classList.add("hidden");
      }
    }

    // Initialize AI Analysis tab panel state
    await initAIAnalysisTab(prop);

    refreshIcons();
    modalDetail.showModal();
  } catch (error) {
    console.error("Gagal memuat detail proposal:", error);
    showToast("Gagal memuat detail proposal.", "error");
  } finally {
    hideLoading();
  }
}

// ==========================================
// AI ANALYSIS MANAGEMENT
// ==========================================

async function getGeminiApiKey() {
  try {
    const config = await getSystemConfig("gemini");
    if (config && config.apiKey) {
      return config.apiKey;
    }
  } catch (err) {
    console.warn("Gagal mengambil Gemini API Key dari Firestore:", err);
  }
  return localStorage.getItem("gemini_api_key");
}

async function initAIAnalysisTab(prop) {
  const aiNotGen = document.getElementById("ai-not-generated");
  const aiGen = document.getElementById("ai-generating");
  const aiRes = document.getElementById("ai-results");
  const btnRunAi = document.getElementById("btn-run-ai-analysis");
  const txtParticipantRestricted = document.getElementById(
    "ai-run-participant-restricted",
  );

  if (!aiNotGen || !aiGen || !aiRes) return;

  // Reset display states
  aiNotGen.classList.add("hidden");
  aiGen.classList.add("hidden");
  aiRes.classList.add("hidden");
  if (txtParticipantRestricted)
    txtParticipantRestricted.classList.add("hidden");
  if (btnRunAi) btnRunAi.classList.remove("hidden");

  const draftIndicator = document.getElementById("ai-run-draft-restricted");
  if (draftIndicator) draftIndicator.classList.add("hidden");

  // Hide API Key configuration for non-admin users (only admin can manage the key)
  const aiKeySettingsContainer = document.getElementById(
    "ai-key-settings-container",
  );
  if (aiKeySettingsContainer) {
    if (currentUser && currentUser.role === "admin") {
      aiKeySettingsContainer.classList.remove("hidden");
    } else {
      aiKeySettingsContainer.classList.add("hidden");
    }
  }

  try {
    // Populate the API key field if found in system config or local storage (admin only)
    const fieldGeminiKey = document.getElementById("field-gemini-key");
    if (fieldGeminiKey && currentUser && currentUser.role === "admin") {
      const savedKey = await getGeminiApiKey();
      if (savedKey) {
        fieldGeminiKey.value = savedKey;
      }
    }

    const analysis = await getAIAnalysis(prop.id);
    if (analysis) {
      // Render analysis results
      renderAIAnalysisResults(analysis);
      aiRes.classList.remove("hidden");
    } else {
      // Analysis not generated yet
      aiNotGen.classList.remove("hidden");

      // RESTRICTION: Block if status is Draft
      if (prop.status === "Draft") {
        if (btnRunAi) btnRunAi.classList.add("hidden");
        const triggerContainer = document.getElementById(
          "ai-run-trigger-container",
        );
        if (triggerContainer) {
          let di = document.getElementById("ai-run-draft-restricted");
          if (!di) {
            di = document.createElement("p");
            di.id = "ai-run-draft-restricted";
            di.className = "text-xs text-amber-400 font-semibold mt-2";
            di.textContent =
              "Analisa AI belum tersedia karena proposal masih berstatus Draf.";
            triggerContainer.appendChild(di);
          } else {
            di.classList.remove("hidden");
          }
        }
      } else {
        // If user is participant (role === 'peserta'), restrict triggering AI analysis
        if (currentUser && currentUser.role === "peserta") {
          if (btnRunAi) btnRunAi.classList.add("hidden");
          if (txtParticipantRestricted)
            txtParticipantRestricted.classList.remove("hidden");
        } else {
          // Setup run analysis click handler
          btnRunAi.onclick = () => runAIAnalysisFlow(prop);
        }
      }
    }
  } catch (error) {
    console.warn("Gagal memuat analisis AI:", error);
    aiNotGen.classList.remove("hidden");
  }
}

function renderAIAnalysisResults(analysis) {
  const scoreOverallEl = document.getElementById("ai-score-overall");
  const analyzedAtEl = document.getElementById("ai-analyzed-at");

  if (scoreOverallEl) scoreOverallEl.textContent = analysis.scoreOverall;
  if (analyzedAtEl) {
    analyzedAtEl.textContent = `Dianalisis: ${new Date(analysis.analyzedAt).toLocaleString("id-ID")}`;
  }

  const keys = ["orisinalitas", "implementasi", "manfaat", "keberlanjutan"];
  keys.forEach((k) => {
    const scoreEl = document.getElementById(`ai-score-${k}`);
    const feedbackEl = document.getElementById(`ai-feedback-${k}`);
    if (scoreEl) scoreEl.textContent = analysis.scores[k];
    if (feedbackEl) feedbackEl.textContent = analysis.feedback[k];
  });

  const strengthsList = document.getElementById("ai-strengths-list");
  if (strengthsList) {
    strengthsList.innerHTML = analysis.strengths
      .map(
        (s) => `
      <li class="flex items-start gap-1.5">
        <span class="text-emerald-500 shrink-0 font-bold">•</span>
        <span>${s}</span>
      </li>
    `,
      )
      .join("");
  }

  const suggestionsList = document.getElementById("ai-suggestions-list");
  if (suggestionsList) {
    suggestionsList.innerHTML = analysis.suggestions
      .map(
        (s) => `
      <li class="flex items-start gap-1.5">
        <span class="text-indigo-400 shrink-0 font-bold">•</span>
        <span>${s}</span>
      </li>
    `,
      )
      .join("");
  }
}

async function runAIAnalysisFlow(prop) {
  const aiNotGen = document.getElementById("ai-not-generated");
  const aiGen = document.getElementById("ai-generating");
  const aiRes = document.getElementById("ai-results");
  const txtStep = document.getElementById("ai-loading-step");
  const elBar = document.getElementById("ai-loading-bar");

  if (!aiNotGen || !aiGen || !aiRes || !txtStep || !elBar) return;

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    showToast(
      "Mohon atur Gemini API Key terlebih dahulu di bagian konfigurasi!",
      "error",
    );
    // Auto-expand the configuration settings block
    const fields = document.getElementById("ai-key-settings-fields");
    const icon = document.getElementById("icon-toggle-ai-settings");
    if (fields) fields.classList.remove("hidden");
    if (icon) icon.style.transform = "rotate(180deg)";
    return;
  }

  aiNotGen.classList.add("hidden");
  aiGen.classList.remove("hidden");
  elBar.style.width = "0%";

  // Step 1: reading proposal details
  txtStep.textContent = "Membaca substansi proposal...";
  elBar.style.width = "20%";
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Step 2: contacting Gemini API
  txtStep.textContent = "Menghubungi Gemini AI Model...";
  elBar.style.width = "40%";

  try {
    const stripHtml = (html) =>
      html ? html.replace(/<[^>]*>/g, "").trim() : "Tidak dilampirkan";
    const promptText = `
Anda adalah reviewer proposal ahli untuk kompetisi inovasi KRENOVA Kota Tegal.
Tugas Anda adalah melakukan kajian kritis dan analisis kelayakan terhadap proposal berikut:

Judul Proposal: ${prop.title}
Kategori/Bidang: ${prop.bidang || prop.category || "Umum"}
Deskripsi Singkat: ${prop.description}

Substansi Proposal:
- Abstrak/Ringkasan: ${stripHtml(prop.proposalContent?.abstrak)}
- Latar Belakang: ${stripHtml(prop.proposalContent?.background)}
- Manfaat: ${stripHtml(prop.proposalContent?.benefits)}
- Rencana Anggaran: ${stripHtml(prop.proposalContent?.budget)}

Kuesioner Mandiri (Jawaban Peserta):
- Keunikan/Orisinalitas ide: ${prop.questionnaire?.orisinalitas1 || "-"}
- Keunggulan dibanding kompetitor: ${prop.questionnaire?.orisinalitas2 || "-"}
- Kesiapan penerapan: ${prop.questionnaire?.penerapan1 || "-"}
- Target pasar/pengguna: ${prop.questionnaire?.manfaat1 || "-"}
- Keberlanjutan pasokan bahan baku: ${prop.questionnaire?.keberlangsungan2 || "-"}

Lakukan analisis mendalam berdasarkan 4 kriteria penilaian Krenova:
1. Orisinalitas & Kebaruan: Keunikan ide inovasi dibanding solusi yang sudah ada di pasar atau regional Kota Tegal.
2. Kelayakan Implementasi: Kesiapan teknis, alokasi anggaran, dan kepraktisan penerapan gagasan.
3. Dampak & Manfaat: Pengaruh positif bagi perekonomian, masyarakat, atau lingkungan di Kota Tegal.
4. Keberlanjutan Inovasi: Kelayakan jangka panjang dari sisi bahan baku, replikasi, dan adopsi jangka panjang.

Hasilkan analisis terstruktur dalam format JSON dengan key:
1. scoreOverall (skor rata-rata dari 4 kriteria, skala 0-100, tipe integer)
2. scores (skor masing-masing kriteria 0-100, tipe objek dengan key: orisinalitas, implementasi, manfaat, keberlanjutan)
3. feedback (deskripsi penjelasan evaluasi kritis untuk masing-masing kriteria dalam 2-3 kalimat berbahasa Indonesia resmi, tipe objek dengan key: orisinalitas, implementasi, manfaat, keberlanjutan)
4. strengths (minimal 3 poin kelebihan utama proposal, tipe array string)
5. suggestions (minimal 3 rekomendasi peningkatan konkret untuk proposal ini, tipe array string)
`;

    // Make the real API call
    const fetchPromise = fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: promptText,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                scoreOverall: { type: "INTEGER" },
                scores: {
                  type: "OBJECT",
                  properties: {
                    orisinalitas: { type: "INTEGER" },
                    implementasi: { type: "INTEGER" },
                    manfaat: { type: "INTEGER" },
                    keberlanjutan: { type: "INTEGER" },
                  },
                  required: [
                    "orisinalitas",
                    "implementasi",
                    "manfaat",
                    "keberlanjutan",
                  ],
                },
                feedback: {
                  type: "OBJECT",
                  properties: {
                    orisinalitas: { type: "STRING" },
                    implementasi: { type: "STRING" },
                    manfaat: { type: "STRING" },
                    keberlanjutan: { type: "STRING" },
                  },
                  required: [
                    "orisinalitas",
                    "implementasi",
                    "manfaat",
                    "keberlanjutan",
                  ],
                },
                strengths: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                },
                suggestions: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                },
              },
              required: [
                "scoreOverall",
                "scores",
                "feedback",
                "strengths",
                "suggestions",
              ],
            },
          },
        }),
      },
    );

    // Step 3: processing response
    txtStep.textContent = "Menganalisis orisinalitas & kelayakan...";
    elBar.style.width = "70%";

    const response = await fetchPromise;
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    txtStep.textContent = "Menyusun laporan evaluasi AI...";
    elBar.style.width = "90%";

    const resData = await response.json();
    const jsonText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) {
      throw new Error("Gagal menerima hasil analisis dalam format yang benar.");
    }

    const analysisData = JSON.parse(jsonText);
    analysisData.analyzedAt = new Date().toISOString();

    // Step 4: final saving
    txtStep.textContent = "Menyimpan ke database...";
    elBar.style.width = "100%";
    await new Promise((resolve) => setTimeout(resolve, 500));

    await saveAIAnalysis(prop.id, analysisData);

    // Switch to results view
    renderAIAnalysisResults(analysisData);
    aiGen.classList.add("hidden");
    aiRes.classList.remove("hidden");

    showToast("Analisa AI berhasil diselesaikan!", "success");
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error("Gemini AI API error:", err);
    showToast(`Analisa AI Gagal: ${err.message}`, "error");
    aiGen.classList.add("hidden");
    aiNotGen.classList.remove("hidden");
  }
}

function generateAIAnalysisData(prop) {
  const title = prop.title || "Inovasi Krenova";
  const bidang = prop.bidang || prop.category || "Umum";

  // Deterministic scores based on title hash
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const randomVal = (h, min, max) => {
    const scale = (Math.abs(h) % 100) / 100;
    return Math.floor(min + scale * (max - min));
  };

  const scoreOrisinalitas = randomVal(hash, 78, 95);
  const scoreImplementasi = randomVal(hash + 11, 75, 92);
  const scoreManfaat = randomVal(hash + 22, 80, 96);
  const scoreKeberlanjutan = randomVal(hash + 33, 70, 90);
  const scoreOverall = Math.round(
    (scoreOrisinalitas +
      scoreImplementasi +
      scoreManfaat +
      scoreKeberlanjutan) /
      4,
  );

  const titleLower = title.toLowerCase();
  let topicWord = "sistem ini";
  if (
    titleLower.includes("air") ||
    titleLower.includes("filtrasi") ||
    titleLower.includes("limbah")
  ) {
    topicWord = "teknologi pengolahan air/lingkungan ini";
  } else if (
    titleLower.includes("sensor") ||
    titleLower.includes("alat") ||
    titleLower.includes("mesin") ||
    titleLower.includes("smart")
  ) {
    topicWord = "perangkat pintar berbasis perangkat keras ini";
  } else if (
    titleLower.includes("aplikasi") ||
    titleLower.includes("web") ||
    titleLower.includes("digital") ||
    titleLower.includes("sistem") ||
    titleLower.includes("platform")
  ) {
    topicWord = "platform solusi digital ini";
  } else if (
    titleLower.includes("pupuk") ||
    titleLower.includes("tanaman") ||
    titleLower.includes("tani") ||
    titleLower.includes("pangan")
  ) {
    topicWord = "inovasi sektor pertanian/pangan ini";
  }

  const originalitasText = `Proposal bertema "${title}" menunjukkan kebaruan yang baik untuk skala regional dalam bidang ${bidang}. AI menilai gagasan ini memiliki keunggulan kompetitif dibanding solusi konvensional karena pendekatan integrasi teknologinya yang orisinal.`;

  const implementasiText = `Secara teknis, ${topicWord} memiliki potensi keberhasilan tinggi untuk diimplementasikan. Rencana pengembangan sudah cukup terstruktur, meskipun perlu mitigasi tambahan pada penyediaan bahan baku lokal atau komponen teknis khusus.`;

  const manfaatText = `Dampak sosial dan ekonomi dari inovasi ini sangat signifikan. Jika diterapkan dengan baik, solusi ini dapat secara langsung meningkatkan efisiensi operasional dan membantu kebutuhan masyarakat lokal sesuai dengan target bidang ${bidang}.`;

  const keberlanjutanText = `Model keberlanjutan jangka panjang dinilai cukup baik. Namun, disarankan untuk menyusun kemitraan strategis dengan instansi pemerintah daerah atau pihak swasta guna memperkuat skalabilitas dan adopsi pasar.`;

  const strengths = [
    `Fokus solusi yang sangat terarah pada penyelesaian masalah nyata di bidang ${bidang}.`,
    `Penggunaan komponen yang relatif modular, memudahkan proses replikasi atau perawatan.`,
    `Potensi biaya implementasi awal yang terjangkau bagi target pengguna.`,
  ];

  const suggestions = [
    `Lakukan uji coba lapangan skala kecil (pilot project) untuk mengumpulkan umpan balik pengguna riil.`,
    `Detailkan analisis kelayakan finansial atau Rencana Anggaran Biaya (RAB) agar lebih menarik bagi calon investor/mitra.`,
    `Daftarkan perlindungan Hak Kekayaan Intelektual (HKI/Paten) untuk melindungi kekhasan inovasi.`,
  ];

  return {
    scoreOverall,
    scores: {
      orisinalitas: scoreOrisinalitas,
      implementasi: scoreImplementasi,
      manfaat: scoreManfaat,
      keberlanjutan: scoreKeberlanjutan,
    },
    feedback: {
      orisinalitas: originalitasText,
      implementasi: implementasiText,
      manfaat: manfaatText,
      keberlanjutan: keberlanjutanText,
    },
    strengths,
    suggestions,
    analyzedAt: new Date().toISOString(),
  };
}

if (btnCloseDetail) {
  btnCloseDetail.addEventListener("click", () => {
    modalDetail.close();
  });
}

async function printEvaluationReport() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast(
      "Gagal membuka jendela cetak. Pastikan pop-up diizinkan.",
      "warning",
    );
    return;
  }

  showLoading("Menyiapkan dokumen cetak...");
  try {
    const proposals = await getAllProposals();
    const evaluations = await getAllEvaluations();
    const juries = await listUsersByRole("juri");

    // Build the set of unique juries based on roles and existing evaluations
    const juryMap = new Map();
    juries.forEach((j) => {
      juryMap.set(j.uid, j.fullName || j.email || `Juri (${j.uid})`);
    });

    // Add any juri who has evaluated a proposal but might not be in the juries list
    evaluations.forEach((e) => {
      if (!juryMap.has(e.juriId)) {
        juryMap.set(e.juriId, e.juriName || `Juri (${e.juriId})`);
      }
    });

    // Convert to a sorted array
    const finalJuries = [];
    juryMap.forEach((name, uid) => {
      finalJuries.push({ uid, name });
    });
    finalJuries.sort((a, b) => a.name.localeCompare(b.name));

    const evalGroup = {};
    evaluations.forEach((e) => {
      if (!evalGroup[e.proposalId]) {
        evalGroup[e.proposalId] = [];
      }
      evalGroup[e.proposalId].push(e);
    });

    const evaluatedProps = proposals.filter(
      (p) => evalGroup[p.id] && evalGroup[p.id].length > 0,
    );

    const processedProps = evaluatedProps.map((p) => {
      const propEvals = evalGroup[p.id];
      const avgScores = propEvals.map((e) => e.average);
      const overallAvg =
        avgScores.reduce((sum, val) => sum + val, 0) / avgScores.length;
      return {
        ...p,
        averageScore: overallAvg,
      };
    });

    const pelajarProps = processedProps
      .filter(
        (p) =>
          (p.kategoriPengusul || "Pelajar").trim().toLowerCase() === "pelajar",
      )
      .sort((a, b) => b.averageScore - a.averageScore);

    const umumProps = processedProps
      .filter(
        (p) =>
          (p.kategoriPengusul || "Pelajar").trim().toLowerCase() === "umum",
      )
      .sort((a, b) => b.averageScore - a.averageScore);

    const renderTableRows = (list) => {
      if (list.length === 0) {
        return `<tr><td colspan="${5 + finalJuries.length}" style="text-align: center; color: #64748b; padding: 15px;">Tidak ada data penilaian untuk kategori ini.</td></tr>`;
      }
      return list
        .map(
          (p, idx) => {
            const propEvals = evalGroup[p.id] || [];
            const juriScoresHtml = finalJuries
              .map((j) => {
                const evalObj = propEvals.find((e) => e.juriId === j.uid);
                const scoreVal = evalObj ? evalObj.average.toFixed(2) : "-";
                return `<td style="text-align: center; font-family: monospace; font-size: 12px;">${scoreVal}</td>`;
              })
              .join("");

            return `
              <tr>
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td style="font-weight: 600;">${p.title}</td>
                <td>${p.fullName || p.authorEmail}</td>
                <td>${p.bidang}</td>
                ${juriScoresHtml}
                <td style="text-align: center; font-family: monospace; font-weight: bold; color: #4f46e5; font-size: 14px;">${p.averageScore.toFixed(2)}</td>
              </tr>
            `;
          },
        )
        .join("");
    };

    const html = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Rekapitulasi Hasil Penilaian Krenova 2026</title>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #1e293b;
            line-height: 1.6;
            margin: 40px;
            font-size: 13px;
            background-color: #fff;
          }
          h1 {
            font-size: 20px;
            margin-bottom: 5px;
            color: #0f172a;
            text-align: center;
            font-weight: 800;
            text-transform: uppercase;
          }
          .subtitle {
            text-align: center;
            color: #64748b;
            font-size: 12px;
            margin-bottom: 30px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .section {
            margin-bottom: 35px;
            page-break-inside: avoid;
          }
          .section h2 {
            font-size: 13px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 6px;
            color: #1e3a8a;
            margin-top: 0;
            margin-bottom: 12px;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 12px;
          }
          .table th, .table td {
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            text-align: left;
          }
          .table th {
            background-color: #f8fafc;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
          }
          .print-header-actions {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 25px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 15px;
          }
          .print-btn {
            background-color: #4f46e5;
            color: white;
            border: none;
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 700;
            border-radius: 6px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .print-btn:hover {
            background-color: #4338ca;
          }
          @media print {
            body {
              margin: 20px;
            }
            .print-header-actions {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-header-actions">
          <button class="print-btn" onclick="window.print()">
            <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
            Cetak Laporan
          </button>
        </div>

        <h1>Laporan Rekapitulasi Hasil Penilaian Proposal Krenova 2026</h1>
        <div class="subtitle">Diurutkan Berdasarkan Nilai Rata-rata Tertinggi per Kategori</div>

        <div class="section">
          <h2>Kategori: Pelajar</h2>
          <table class="table">
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">Peringkat</th>
                <th>Judul Proposal</th>
                <th>Inovator / Ketua Tim</th>
                <th>Bidang Lomba</th>
                ${finalJuries
                  .map(
                    (j) =>
                      `<th style="text-align: center; font-size: 10px;">${j.name}</th>`,
                  )
                  .join("")}
                <th style="width: 120px; text-align: center;">Nilai Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              ${renderTableRows(pelajarProps)}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Kategori: Umum</h2>
          <table class="table">
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">Peringkat</th>
                <th>Judul Proposal</th>
                <th>Inovator / Ketua Tim</th>
                <th>Bidang Lomba</th>
                ${finalJuries
                  .map(
                    (j) =>
                      `<th style="text-align: center; font-size: 10px;">${j.name}</th>`,
                  )
                  .join("")}
                <th style="width: 120px; text-align: center;">Nilai Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              ${renderTableRows(umumProps)}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  } catch (error) {
    console.error("Gagal mencetak laporan rekapitulasi penilaian:", error);
    showToast("Gagal memproses data laporan.", "error");
    printWindow.close();
  } finally {
    hideLoading();
  }
}

if (btnPrintDetail) {
  btnPrintDetail.addEventListener("click", async () => {
    if (activeDetailProposal) {
      await printProposal(activeDetailProposal);
    }
  });
}

async function printProposal(prop) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast(
      "Gagal membuka jendela cetak. Pastikan pop-up diizinkan.",
      "warning",
    );
    return;
  }

  const content = prop.proposalContent || {};
  const q = prop.questionnaire || {};
  const anggotaList =
    prop.statusTim === "Kelompok" && prop.anggota && prop.anggota.length > 0
      ? prop.anggota.map((a) => `<li>${a}</li>`).join("")
      : "<li>Tidak ada (Perorangan)</li>";

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <title>Proposal Krenova: ${prop.title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1e293b;
          line-height: 1.6;
          margin: 40px;
          font-size: 13.5px;
          background-color: #fff;
        }
        h1 {
          font-size: 22px;
          margin-bottom: 5px;
          color: #0f172a;
          text-align: center;
          font-weight: 800;
        }
        .subtitle {
          text-align: center;
          color: #4f46e5;
          font-size: 14px;
          margin-bottom: 30px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section {
          margin-bottom: 25px;
          page-break-inside: avoid;
        }
        .section h2 {
          font-size: 14px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 6px;
          color: #1e3a8a;
          margin-bottom: 12px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 15px;
        }
        .info-item {
          margin-bottom: 8px;
        }
        .info-label {
          font-weight: 700;
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          display: block;
          margin-bottom: 2px;
        }
        .info-val {
          font-size: 13px;
          color: #1e293b;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 12.5px;
        }
        .table th, .table td {
          border: 1px solid #e2e8f0;
          padding: 8px 12px;
          text-align: left;
        }
        .table th {
          background-color: #f8fafc;
          font-weight: 700;
          color: #475569;
        }
        .rich-text {
          font-size: 13px;
          color: #334155;
          background: #fafafa;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
        }
        .rich-text p {
          margin-top: 0;
          margin-bottom: 8px;
        }
        .rich-text p:last-child {
          margin-bottom: 0;
        }
        ol.q-list {
          padding-left: 20px;
          margin: 0;
        }
        ol.q-list li {
          margin-bottom: 12px;
        }
        .q-question {
          font-weight: 600;
          color: #0f172a;
          font-size: 13px;
        }
        .q-answer {
          color: #475569;
          font-style: italic;
          margin-top: 4px;
          font-size: 12.5px;
          background-color: #f8fafc;
          padding: 6px 10px;
          border-left: 2px solid #cbd5e1;
        }
        .print-header-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 25px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 15px;
        }
        .print-btn {
          background-color: #4f46e5;
          color: white;
          border: none;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .print-btn:hover {
          background-color: #4338ca;
        }
        @media print {
          body {
            margin: 20px;
          }
          .print-header-actions {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-header-actions">
        <button class="print-btn" onclick="window.print()">
          <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
          Cetak Dokumen
        </button>
      </div>

      <h1>PROPOSAL INOVASI KRENOVA 2026</h1>
      <div class="subtitle">${prop.title}</div>

      <div class="section">
        <h2>Identitas Proposal & Pengusul</h2>
        <div class="grid">
          <div>
            <div class="info-item">
              <span class="info-label">ID Proposal</span>
              <span class="info-val" style="font-family: monospace; font-weight: 600;">${prop.id}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Nama Inovator / Ketua Tim</span>
              <span class="info-val">${prop.fullName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email Pengusul</span>
              <span class="info-val">${prop.authorEmail}</span>
            </div>
            <div class="info-item">
              <span class="info-label">No. Telepon / WA</span>
              <span class="info-val">${prop.phone}</span>
            </div>
          </div>

          <div>
            <div class="info-item">
              <span class="info-label">Tahun Pelaksanaan</span>
              <span class="info-val">${prop.tahun || 2026}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Bidang Lomba</span>
              <span class="info-val">${prop.bidang}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Kategori Lomba</span>
              <span class="info-val">${prop.kategoriPengusul}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status Anggota</span>
              <span class="info-val">${prop.statusTim}</span>
            </div>
          </div>
        </div>

        <div class="grid">
          <div>
            <div class="info-item">
              <span class="info-label">Alamat Lengkap</span>
              <span class="info-val">${prop.address}</span>
            </div>
          </div>
          <div>
            <div class="info-item">
              <span class="info-label">Koordinat Lokasi</span>
              <span class="info-val">${prop.latitude ? prop.latitude.toFixed(6) : "-"}, ${prop.longitude ? prop.longitude.toFixed(6) : "-"}</span>
            </div>
          </div>
        </div>

        <div class="info-item" style="margin-top: 5px;">
          <span class="info-label">Anggota Kelompok</span>
          <span class="info-val">
            <ul style="margin: 0; padding-left: 20px;">
              ${anggotaList}
            </ul>
          </span>
        </div>
      </div>

      <div class="section">
        <h2>A. Abstrak / Ringkasan</h2>
        <div class="rich-text">${content.abstrak || "Tidak ada konten."}</div>
      </div>

      <div class="section">
        <h2>B. Latar Belakang</h2>
        <div class="rich-text">${content.background || "Tidak ada konten."}</div>
      </div>

      <div class="section">
        <h2>C. Maksud dan Tujuan</h2>
        <div class="rich-text">${content.objectives || "Tidak ada konten."}</div>
      </div>

      <div class="section">
        <h2>D. Manfaat Inovasi</h2>
        <div class="rich-text">${content.benefits || "Tidak ada konten."}</div>
      </div>

      <div class="section">
        <h2>E. Keunggulan Inovasi</h2>
        <div class="rich-text">${content.keunggulan || "Tidak ada konten."}</div>
      </div>

      <div class="section">
        <h2>F. Aspek Inovasi</h2>
        <div class="rich-text">${content.aspek || "Tidak ada konten."}</div>
      </div>

      <div class="section">
        <h2>G. Penerapan Inovasi</h2>
        <div class="rich-text">${content.penerapan || "Tidak ada konten."}</div>
      </div>

      <div class="section">
        <h2>H. Anggaran Biaya</h2>
        <div class="rich-text">${content.budget || "Tidak ada konten."}</div>
      </div>

      <div class="section" style="page-break-before: always;">
        <h2>Kuesioner Penilaian Mandiri</h2>

        <h3 style="font-size: 13px; margin-top: 15px; color: #1e3a8a; font-weight: 700;">A. ORISINALITAS DAN KEPIONIRAN</h3>
        <ol class="q-list">
          <li>
            <div class="q-question">Apakah temuan benar-benar asli milik saudara?</div>
            <div class="q-answer">${q.orisinalitas1 || "-"}</div>
          </li>
          <li>
            <div class="q-question">Apakah ide/inovasi hasil pengembangan sebelumnya? Apabila Jawaban "Iya" Pengembangan ada di bagian apa?</div>
            <div class="q-answer">${q.orisinalitas2 || "-"}</div>
          </li>
          <li>
            <div class="q-question">Apakah ada inovasi sejenis? Jika ada apa perbedaan inovasi yang anda miliki?</div>
            <div class="q-answer">${q.orisinalitas3 || "-"}</div>
          </li>
        </ol>

        <h3 style="font-size: 13px; margin-top: 20px; color: #1e3a8a; font-weight: 700;">B. PENERAPAN DI MASYARAKAT</h3>
        <ol class="q-list" start="4">
          <li>
            <div class="q-question">Apakah sudah dilakukan Ujicoba pada lingkungan yang relevan? Dimana dan Bagaimana hasil penerapannya?</div>
            <div class="q-answer">${q.penerapan1 || "-"}</div>
          </li>
          <li>
            <div class="q-question">Apakah inovasi yang di hasilkan sudah siap terapkan? Siapakah yang menerapkan?</div>
            <div class="q-answer">${q.penerapan2 || "-"}</div>
          </li>
          <li>
            <div class="q-question">Skala jangkauan penerapan pada skala apa (Nasional/Provinsi/Kab dan Kota/Kecamatan/Desa)?</div>
            <div class="q-answer">${q.penerapan3 || "-"}</div>
          </li>
        </ol>

        <h3 style="font-size: 13px; margin-top: 20px; color: #1e3a8a; font-weight: 700;">C. MANFAAT</h3>
        <ol class="q-list" start="7">
          <li>
            <div class="q-question">Apakah inovasi yang dihasilkan dapat menyelesaikan permasalahan aktual saat ini? Jelaskan?</div>
            <div class="q-answer">${q.manfaat1 || "-"}</div>
          </li>
          <li>
            <div class="q-question">Apakah inovasi dapat meningkatkan proses produksi/efisiensi? Jelaskan</div>
            <div class="q-answer">${q.manfaat2 || "-"}</div>
          </li>
          <li>
            <div class="q-question">Apakah memberi manfaat kelingkungan? Dalam bentuk apa?</div>
            <div class="q-answer">${q.manfaat3 || "-"}</div>
          </li>
          <li>
            <div class="q-question">Apakah menyerap tenaga kerja pada proses produksi? Berapa?</div>
            <div class="q-answer">${q.manfaat4 || "-"}</div>
          </li>
          <li>
            <div class="q-question">Apakah dapat meningkatkan pendapatan masyarakat? Berapa?</div>
            <div class="q-answer">${q.manfaat5 || "-"}</div>
          </li>
        </ol>

        <h3 style="font-size: 13px; margin-top: 20px; color: #1e3a8a; font-weight: 700;">D. KEBERLANGSUNGAN / KOMERSIALISASI</h3>
        <ol class="q-list" start="12">
          <li>
            <div class="q-question">Berapa persen penyerapan penggunaan sumberdaya lokal (SDM dan Bahan baku lokal)?</div>
            <div class="q-answer">${q.keberlangsungan1 || "-"}</div>
          </li>
          <li>
            <div class="q-question">Apakah ketersediaan bahan baku kontinyu secara kualitas dan kuantitas?</div>
            <div class="q-answer">${q.keberlangsungan2 || "-"}</div>
          </li>
        </ol>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

const tabDets = document.querySelectorAll(".tab-det");
tabDets.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabDets.forEach((t) => {
      t.classList.remove("active", "border-indigo-500", "text-white");
      t.classList.add("border-transparent", "text-slate-400");
    });
    tab.classList.add("active", "border-indigo-500", "text-white");
    tab.classList.remove("border-transparent", "text-slate-400");

    document
      .querySelectorAll(".tab-det-panel")
      .forEach((p) => p.classList.add("hidden"));
    const targetPanelId = tab.id.replace("tab-", "panel-");
    const targetPanel = document.getElementById(targetPanelId);
    if (targetPanel) {
      targetPanel.classList.remove("hidden");
    }

    if (targetPanelId === "panel-det-overview" && detailMap) {
      setTimeout(() => detailMap.invalidateSize(), 100);
    }
  });
});

async function editProposalDraft(prop) {
  wizardForm.reset();

  document.getElementById("field-proposal-id").value = prop.id;
  document.getElementById("field-tahun").value = prop.tahun || 2026;
  document.getElementById("field-nama-email").value = prop.namaEmail || "";
  document.getElementById("field-fullname").value = prop.fullName || "";
  document.getElementById("field-phone").value = prop.phone || "";
  document.getElementById("field-address").value = prop.address || "";
  document.getElementById("field-kategori-pengusul").value =
    prop.kategoriPengusul || "Pelajar";
  document.getElementById("field-status-tim").value =
    prop.statusTim || "Perorangan";

  const containerAnggotaTim = document.getElementById("container-anggota-tim");
  if (prop.statusTim === "Kelompok") {
    if (containerAnggotaTim) containerAnggotaTim.classList.remove("hidden");
    document.getElementById("field-anggota1").value = prop.anggota?.[0] || "";
    document.getElementById("field-anggota2").value = prop.anggota?.[1] || "";
    document.getElementById("field-anggota3").value = prop.anggota?.[2] || "";
    document.getElementById("field-anggota4").value = prop.anggota?.[3] || "";
  } else {
    if (containerAnggotaTim) containerAnggotaTim.classList.add("hidden");
  }

  document.getElementById("field-title").value = prop.title || "";

  await populateBidangDropdown();
  document.getElementById("field-bidang").value = prop.bidang || "";
  document.getElementById("field-jenis-inovasi").value =
    prop.jenisInovasi || "Digital";
  document.getElementById("field-tahap-inovasi").value =
    prop.tahapInovasi || "Uji Coba";
  document.getElementById("field-description").value = prop.description || "";

  const content = prop.proposalContent || {};
  editorIds.forEach((id) => {
    if (editors[id]) {
      editors[id].root.innerHTML = content[id] || "";
    }
  });

  const q = prop.questionnaire || {};
  document.getElementById("field-q-orisinalitas1").value =
    q.orisinalitas1 || "";
  document.getElementById("field-q-orisinalitas2").value =
    q.orisinalitas2 || "";
  document.getElementById("field-q-orisinalitas3").value =
    q.orisinalitas3 || "";
  document.getElementById("field-q-penerapan1").value = q.penerapan1 || "";
  document.getElementById("field-q-penerapan2").value = q.penerapan2 || "";
  document.getElementById("field-q-penerapan3").value =
    q.penerapan3 || "Kab dan Kota";
  document.getElementById("field-q-manfaat1").value = q.manfaat1 || "";
  document.getElementById("field-q-manfaat2").value = q.manfaat2 || "";
  document.getElementById("field-q-manfaat3").value = q.manfaat3 || "";
  document.getElementById("field-q-manfaat4").value = q.manfaat4 || "";
  document.getElementById("field-q-manfaat5").value = q.manfaat5 || "";
  document.getElementById("field-q-keberlangsungan1").value =
    q.keberlangsungan1 || "";
  document.getElementById("field-q-keberlangsungan2").value =
    q.keberlangsungan2 || "";

  document.getElementById("field-latitude").value = prop.latitude || "";
  document.getElementById("field-longitude").value = prop.longitude || "";
  document.getElementById("field-video-url").value = prop.videoUrl || "";

  document.getElementById("field-photo-url").value = prop.teamPhotoUrl || "";
  document.getElementById("field-identity-url").value =
    prop.identityDocUrl || "";
  document.getElementById("field-originality-url").value =
    prop.originalityDocUrl || "";
  document.getElementById("field-approval-url").value =
    prop.approvalDocUrl || "";

  uploadedProductPhotos = prop.productPhotosUrls || [];
  document.getElementById("field-products-urls").value = JSON.stringify(
    uploadedProductPhotos,
  );

  setUploadVisualOnEdit("photo", prop.teamPhotoUrl, "foto_peserta.jpg");
  setUploadVisualOnEdit("identity", prop.identityDocUrl, "ktp_identitas.pdf");
  setUploadVisualOnEdit(
    "originality",
    prop.originalityDocUrl,
    "orisinalitas.pdf",
  );
  setUploadVisualOnEdit("approval", prop.approvalDocUrl, "pengesahan.pdf");
  renderProductPreviews();

  currentStep = 1;
  updateWizardUI();

  document.getElementById("form-wizard-title").textContent =
    "Edit Draf Proposal Inovasi";
  showSection("section-form");
}

function setUploadVisualOnEdit(type, url, filename) {
  if (!url) {
    resetFileUploadZone(type);
    return;
  }
  const infoState = document.getElementById(`${type}-dropzone-info`);
  const previewState = document.getElementById(`${type}-preview-container`);
  const previewFilename = document.getElementById(`${type}-preview-filename`);

  if (infoState) infoState.classList.add("hidden");
  if (previewState) previewState.classList.remove("hidden");
  if (previewFilename) previewFilename.textContent = filename;

  if (type === "photo") {
    const previewImg = document.getElementById("photo-preview-img");
    if (previewImg) previewImg.src = url;
  }
}

// Close modals triggers
document
  .getElementById("btn-close-juri-modal")
  ?.addEventListener("click", () => {
    document.getElementById("modal-admin-juri").close();
  });
document
  .getElementById("btn-close-bidang-modal")
  ?.addEventListener("click", () => {
    document.getElementById("modal-admin-bidang").close();
  });
document
  .getElementById("btn-close-score-modal")
  ?.addEventListener("click", () => {
    document.getElementById("modal-juri-score").close();
  });
document
  .getElementById("btn-close-eval-modal")
  ?.addEventListener("click", () => {
    document.getElementById("modal-admin-juri-evaluations").close();
  });

// ----------------------------------------------------
// FLOATING COUNTDOWN TIMER LOGIC
// ----------------------------------------------------
let targetTime = new Date("2026-06-13T16:00:00+07:00").getTime();

const elDays = document.getElementById("cd-days");
const elHours = document.getElementById("cd-hours");
const elMins = document.getElementById("cd-mins");
const elSecs = document.getElementById("cd-secs");
const elPulse = document.getElementById("cd-pulse");
const elHeader = document.getElementById("cd-header-text");

let countdownInterval;

function setCountdownTarget(timestamp, rawIso) {
  targetTime = timestamp;
  const elDateText = document.getElementById("cd-date-text");
  if (elDateText && rawIso) {
    const date = new Date(rawIso);
    const formatted =
      date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB";
    elDateText.textContent = `Batas pendaftaran: ${formatted}`;
  }
  updateCountdown();
}

function updateCountdown() {
  const now = new Date().getTime();
  const diff = targetTime - now;

  if (diff <= 0) {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    isRegistrationClosed = true;

    if (elDays) elDays.textContent = "00";
    if (elHours) elHours.textContent = "00";
    if (elMins) elMins.textContent = "00";
    if (elSecs) elSecs.textContent = "00";

    if (elPulse) {
      elPulse.classList.remove("bg-rose-500", "animate-ping");
      elPulse.classList.add("bg-slate-500");
    }
    if (elHeader) {
      elHeader.textContent = "Pendaftaran Ditutup";
      elHeader.parentElement.className =
        "flex items-center gap-2 text-slate-500 font-display font-bold text-xs uppercase tracking-wider";
    }

    const activeSec = document.querySelector(".view-section.active");
    if (activeSec && activeSec.id === "section-form") {
      showToast("Waktu pendaftaran telah habis. Formulir ditutup.", "error");
      showSection("section-dashboard");
    }
  } else {
    isRegistrationClosed = false;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (elDays) elDays.textContent = String(days).padStart(2, "0");
    if (elHours) elHours.textContent = String(hours).padStart(2, "0");
    if (elMins) elMins.textContent = String(minutes).padStart(2, "0");
    if (elSecs) elSecs.textContent = String(seconds).padStart(2, "0");

    if (diff < 24 * 60 * 60 * 1000) {
      if (elPulse)
        elPulse.className = "w-2.5 h-2.5 rounded-full bg-red-500 animate-ping";
      if (elSecs)
        elSecs.className = "text-lg font-extrabold text-red-500 block -mb-1";
    } else {
      if (elPulse)
        elPulse.className = "w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping";
      if (elSecs)
        elSecs.className = "text-lg font-extrabold text-rose-400 block -mb-1";
    }
  }
}

async function loadScheduleConfig() {
  try {
    const schedule = await getSystemConfig("schedule");
    if (schedule) {
      if (schedule.entry_end) {
        const entryEnd = new Date(schedule.entry_end);
        if (!isNaN(entryEnd.getTime())) {
          setCountdownTarget(entryEnd.getTime(), schedule.entry_end);
        }
      }

      const elEntryStart = document.getElementById("schedule-entry-start");
      const elEntryEnd = document.getElementById("schedule-entry-end");
      const elEvalStart = document.getElementById("schedule-eval-start");
      const elEvalEnd = document.getElementById("schedule-eval-end");

      if (elEntryStart) elEntryStart.value = schedule.entry_start || "";
      if (elEntryEnd) elEntryEnd.value = schedule.entry_end || "";
      if (elEvalStart) elEvalStart.value = schedule.eval_start || "";
      if (elEvalEnd) elEvalEnd.value = schedule.eval_end || "";

      const elPollActive = document.getElementById("schedule-poll-active");
      const elPollStart = document.getElementById("schedule-poll-start");
      const elPollEnd = document.getElementById("schedule-poll-end");

      if (elPollActive) elPollActive.checked = schedule.poll_active || false;
      if (elPollStart) elPollStart.value = schedule.poll_start || "";
      if (elPollEnd) elPollEnd.value = schedule.poll_end || "";

      const elViewEntry = document.getElementById("view-schedule-entry");
      const elViewEval = document.getElementById("view-schedule-eval");

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

      if (elViewEntry)
        elViewEntry.textContent = `${formatScheduleDate(schedule.entry_start)} s/d ${formatScheduleDate(schedule.entry_end)}`;
      if (elViewEval)
        elViewEval.textContent = `${formatScheduleDate(schedule.eval_start)} s/d ${formatScheduleDate(schedule.eval_end)}`;

      const elPollRange = document.getElementById("poll-schedule-range-text");
      if (elPollRange) {
        elPollRange.textContent = `${formatScheduleDate(schedule.poll_start)} s/d ${formatScheduleDate(schedule.poll_end)}`;
      }

      const now = new Date();
      const evalStart = schedule.eval_start
        ? new Date(schedule.eval_start)
        : null;
      const evalEnd = schedule.eval_end ? new Date(schedule.eval_end) : null;

      let juriStatus = "Belum masuk periode penilaian.";
      if (evalStart && evalEnd) {
        if (now < evalStart) {
          juriStatus = `Periode penilaian belum dimulai. Dimulai pada ${formatScheduleDate(schedule.eval_start)}`;
        } else if (now >= evalStart && now <= evalEnd) {
          juriStatus = `Periode penilaian sedang aktif! Berakhir pada ${formatScheduleDate(schedule.eval_end)}`;
        } else {
          juriStatus = "Periode penilaian telah ditutup.";
        }
      }

      const elJuriStatus = document.getElementById("juri-schedule-status-text");
      if (elJuriStatus) elJuriStatus.textContent = juriStatus;

      const elAdminStatus = document.getElementById(
        "admin-schedule-status-text",
      );
      if (elAdminStatus) elAdminStatus.textContent = juriStatus;


    }
  } catch (e) {
    console.error("Gagal memuat konfigurasi jadwal:", e);
  }
}

updateCountdown();
countdownInterval = setInterval(updateCountdown, 1000);

const btnToggleCountdown = document.getElementById("btn-toggle-countdown");
const countdownDisplay = document.getElementById("countdown-timer-display");
const cdDateText = document.getElementById("cd-date-text");
const cdChevron = document.getElementById("cd-chevron");

if (btnToggleCountdown) {
  btnToggleCountdown.addEventListener("click", () => {
    if (countdownDisplay) {
      countdownDisplay.classList.toggle("max-h-0");
      countdownDisplay.classList.toggle("py-0");
    }
    if (cdDateText) {
      cdDateText.classList.toggle("max-h-0");
    }
    if (cdChevron) {
      cdChevron.classList.toggle("rotate-180");
    }
  });
}

async function checkRegistrationActive() {
  try {
    const schedule = await getSystemConfig("schedule");
    if (!schedule) return { active: true, reason: "" };

    const now = new Date();
    const start = schedule.entry_start ? new Date(schedule.entry_start) : null;
    const end = schedule.entry_end ? new Date(schedule.entry_end) : null;

    if (start && now < start) {
      const formatted =
        new Date(schedule.entry_start).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB";
      return {
        active: false,
        reason: `Pendaftaran KRENOVA 2026 belum dibuka! (Dimulai pada ${formatted})`,
      };
    }
    if (end && now > end) {
      return {
        active: false,
        reason: "Pendaftaran KRENOVA 2026 telah ditutup!",
      };
    }
    return { active: true, reason: "" };
  } catch (e) {
    console.error("Gagal memeriksa keaktifan jadwal:", e);
    return { active: true, reason: "" };
  }
}

// ==========================================
// GEMINI KEY CONFIGURATION AND SETUP
// ==========================================

const btnToggleAiSettings = document.getElementById("btn-toggle-ai-settings");
const aiSettingsFields = document.getElementById("ai-key-settings-fields");
const iconToggleAiSettings = document.getElementById("icon-toggle-ai-settings");

if (btnToggleAiSettings && aiSettingsFields && iconToggleAiSettings) {
  btnToggleAiSettings.addEventListener("click", () => {
    const isHidden = aiSettingsFields.classList.contains("hidden");
    if (isHidden) {
      aiSettingsFields.classList.remove("hidden");
      iconToggleAiSettings.style.transform = "rotate(180deg)";
    } else {
      aiSettingsFields.classList.add("hidden");
      iconToggleAiSettings.style.transform = "rotate(0deg)";
    }
  });
}

const btnSaveGeminiKey = document.getElementById("btn-save-gemini-key");
const fieldGeminiKey = document.getElementById("field-gemini-key");

if (btnSaveGeminiKey && fieldGeminiKey) {
  // Populate initially if saved
  getGeminiApiKey().then((savedKey) => {
    if (savedKey) {
      fieldGeminiKey.value = savedKey;
    }
  });

  btnSaveGeminiKey.addEventListener("click", async () => {
    const keyVal = fieldGeminiKey.value.trim();
    if (!keyVal) {
      showToast("API Key tidak boleh kosong.", "error");
      return;
    }

    showLoading("Menyimpan API Key...");
    try {
      // Save to Firestore so other juries/admins can share it
      await saveSystemConfig("gemini", { apiKey: keyVal });

      // Also cache in LocalStorage
      localStorage.setItem("gemini_api_key", keyVal);
      showToast(
        "Gemini API Key berhasil disimpan ke cloud & lokal!",
        "success",
      );

      // Collapse settings after save
      if (aiSettingsFields) {
        aiSettingsFields.classList.add("hidden");
        if (iconToggleAiSettings)
          iconToggleAiSettings.style.transform = "rotate(0deg)";
      }
    } catch (e) {
      console.error("Gagal menyimpan API Key ke Cloud:", e);
      // Fallback: save locally only
      localStorage.setItem("gemini_api_key", keyVal);
      showToast(
        "API Key disimpan secara lokal (Gagal sync ke Cloud).",
        "warning",
      );

      // Collapse settings after save
      if (aiSettingsFields) {
        aiSettingsFields.classList.add("hidden");
        if (iconToggleAiSettings)
          iconToggleAiSettings.style.transform = "rotate(0deg)";
      }
    } finally {
      hideLoading();
    }
  });
}



// ----------------------------------------------------
// ADMIN POLLING RESULTS VISUALIZATION
// ----------------------------------------------------
async function loadAdminPollingResults() {
  const elTotal = document.getElementById("admin-poll-total-votes");
  const elPelajarTotal = document.getElementById("admin-poll-pelajar-votes");
  const elUmumTotal = document.getElementById("admin-poll-umum-votes");
  
  const elPelajarRatio = document.getElementById("admin-poll-pelajar-ratio");
  const elUmumRatio = document.getElementById("admin-poll-umum-ratio");

  const tbodyPelajar = document.getElementById("table-admin-poll-pelajar");
  const tbodyUmum = document.getElementById("table-admin-poll-umum");

  if (!tbodyPelajar || !tbodyUmum) return;

  tbodyPelajar.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-slate-400">Memuat...</td></tr>`;
  tbodyUmum.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-slate-400">Memuat...</td></tr>`;

  try {
    const votes = await getPollVotes();
    const proposals = await getAllProposals("juri");

    const totalVotes = votes.length;
    const pelajarVotesMap = {};
    const umumVotesMap = {};

    let pelajarVotesCount = 0;
    let umumVotesCount = 0;

    votes.forEach(v => {
      if (v.pelajarProposalId) {
        pelajarVotesMap[v.pelajarProposalId] = (pelajarVotesMap[v.pelajarProposalId] || 0) + 1;
        pelajarVotesCount++;
      }
      if (v.umumProposalId) {
        umumVotesMap[v.umumProposalId] = (umumVotesMap[v.umumProposalId] || 0) + 1;
        umumVotesCount++;
      }
    });

    if (elTotal) elTotal.textContent = totalVotes;
    if (elPelajarTotal) elPelajarTotal.textContent = pelajarVotesCount;
    if (elUmumTotal) elUmumTotal.textContent = umumVotesCount;

    const pelajarPercentage = totalVotes > 0 ? (pelajarVotesCount / totalVotes * 100).toFixed(0) : 0;
    const umumPercentage = totalVotes > 0 ? (umumVotesCount / totalVotes * 100).toFixed(0) : 0;
    
    if (elPelajarRatio) elPelajarRatio.textContent = `${pelajarPercentage}% dari total suara`;
    if (elUmumRatio) elUmumRatio.textContent = `${umumPercentage}% dari total suara`;

    const pelajarProps = proposals.filter(p => (p.kategoriPengusul || "Pelajar").trim().toLowerCase() === "pelajar");
    const umumProps = proposals.filter(p => (p.kategoriPengusul || "Pelajar").trim().toLowerCase() === "umum");

    pelajarProps.forEach(p => {
      p.pollVotes = pelajarVotesMap[p.id] || 0;
    });
    umumProps.forEach(p => {
      p.pollVotes = umumVotesMap[p.id] || 0;
    });

    pelajarProps.sort((a, b) => b.pollVotes - a.pollVotes);
    umumProps.sort((a, b) => b.pollVotes - a.pollVotes);

    // Render Pelajar table
    if (pelajarProps.length === 0) {
      tbodyPelajar.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-slate-500">Belum ada proposal pelajar yang disetujui.</td></tr>`;
    } else {
      tbodyPelajar.innerHTML = "";
      pelajarProps.forEach((p, idx) => {
        const percent = pelajarVotesCount > 0 ? (p.pollVotes / pelajarVotesCount * 100) : 0;
        tbodyPelajar.appendChild(createAdminPollRow(p, idx + 1, percent, "purple"));
      });
    }

    // Render Umum table
    if (umumProps.length === 0) {
      tbodyUmum.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-slate-500">Belum ada proposal umum yang disetujui.</td></tr>`;
    } else {
      tbodyUmum.innerHTML = "";
      umumProps.forEach((p, idx) => {
        const percent = umumVotesCount > 0 ? (p.pollVotes / umumVotesCount * 100) : 0;
        tbodyUmum.appendChild(createAdminPollRow(p, idx + 1, percent, "cyan"));
      });
    }
  } catch (e) {
    console.error("Gagal memuat hasil polling admin:", e);
    tbodyPelajar.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-rose-400">Gagal memuat data polling.</td></tr>`;
    tbodyUmum.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-rose-400">Gagal memuat data polling.</td></tr>`;
  }
  refreshIcons();
}

function createAdminPollRow(prop, rank, percent, themeColor) {
  const tr = document.createElement("tr");
  tr.className = "hover:bg-white/5 transition-colors border-b border-white/5";
  
  let rankDisplay = rank;
  if (rank === 1) {
    rankDisplay = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold">🥇</span>`;
  } else if (rank === 2) {
    rankDisplay = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/30 text-xs font-bold">🥈</span>`;
  } else if (rank === 3) {
    rankDisplay = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/30 text-xs font-bold">🥉</span>`;
  } else {
    rankDisplay = `<span class="text-xs text-slate-400 font-mono font-bold">${rank}</span>`;
  }

  const barColorClass = themeColor === "purple" ? "bg-purple-500" : "bg-cyan-400";
  
  tr.innerHTML = `
    <td class="px-4 py-4 text-center">${rankDisplay}</td>
    <td class="px-4 py-4">
      <h4 class="font-display font-bold text-white text-sm truncate max-w-[200px]" title="${prop.title || prop.judul_inovasi}">${prop.title || prop.judul_inovasi}</h4>
      <p class="text-xs text-slate-500 mt-0.5">${prop.fullName || prop.nama_inovator || "Inovator"}</p>
    </td>
    <td class="px-4 py-4 text-right font-mono font-bold text-white">${prop.pollVotes}</td>
    <td class="px-4 py-4">
      <div class="flex items-center justify-end gap-2">
        <div class="w-20 bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div class="h-full ${barColorClass} rounded-full" style="width: ${percent}%"></div>
        </div>
        <span class="text-xs font-mono font-semibold text-slate-400 w-10 text-right">${percent.toFixed(0)}%</span>
      </div>
    </td>
  `;
  return tr;
}
