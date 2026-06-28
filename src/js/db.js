import { db, isMock } from "./firebase-config.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  orderBy,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Helper for Mock Data
export const getMockUsers = () => {
  let users = JSON.parse(localStorage.getItem("krenova_users") || "[]");
  if (users.length === 0) {
    users = [
      {
        uid: "mock-admin",
        email: "admin@krenova.com",
        fullName: "Administrator Krenova",
        role: "admin",
        createdAt: new Date().toISOString()
      },
      {
        uid: "mock-admin-galileo",
        email: "galileo21@gmail.com",
        fullName: "Galileo (Admin Utama)",
        role: "admin",
        createdAt: new Date().toISOString()
      },
      {
        uid: "mock-juri1",
        email: "juri@krenova.com",
        fullName: "Juri Krenova 1",
        role: "juri",
        createdAt: new Date().toISOString()
      },
      {
        uid: "mock-juri2",
        email: "juri2@krenova.com",
        fullName: "Juri Krenova 2",
        role: "juri",
        createdAt: new Date().toISOString()
      },
      {
        uid: "mock-peserta",
        email: "peserta@krenova.com",
        fullName: "Peserta Krenova",
        role: "peserta",
        createdAt: new Date().toISOString()
      }
    ];
    localStorage.setItem("krenova_users", JSON.stringify(users));
  }
  
  // Ensure galileo21@gmail.com is present in mock users as admin
  const hasGalileo = users.some(u => u.email.toLowerCase() === "galileo21@gmail.com");
  if (!hasGalileo) {
    users.push({
      uid: "mock-admin-galileo",
      email: "galileo21@gmail.com",
      fullName: "Galileo (Admin Utama)",
      role: "admin",
      createdAt: new Date().toISOString()
    });
    localStorage.setItem("krenova_users", JSON.stringify(users));
  }
  return users;
};

export const saveMockUsers = (users) => localStorage.setItem("krenova_users", JSON.stringify(users));

const getMockProposals = () => JSON.parse(localStorage.getItem("krenova_proposals") || "[]");
const saveMockProposals = (proposals) => localStorage.setItem("krenova_proposals", JSON.stringify(proposals));

const getMockBidang = () => {
  let bidang = JSON.parse(localStorage.getItem("krenova_bidang") || "[]");
  if (bidang.length === 0) {
    bidang = [
      { id: "b1", nama: "Teknologi" },
      { id: "b2", nama: "Seni & Desain" },
      { id: "b3", nama: "Agribisnis & Pangan" },
      { id: "b4", nama: "Energi & Lingkungan" },
      { id: "b5", nama: "Kesehatan" },
      { id: "b6", nama: "Pendidikan" }
    ];
    localStorage.setItem("krenova_bidang", JSON.stringify(bidang));
  }
  return bidang;
};
const saveMockBidang = (bidang) => localStorage.setItem("krenova_bidang", JSON.stringify(bidang));

const getMockPenilaian = () => JSON.parse(localStorage.getItem("krenova_penilaian") || "[]");
const saveMockPenilaian = (penilaian) => localStorage.setItem("krenova_penilaian", JSON.stringify(penilaian));

const getMockConfigs = () => {
  let configs = JSON.parse(localStorage.getItem("krenova_configs") || "{}");
  if (Object.keys(configs).length === 0) {
    configs = {
      schedule: {
        entry_start: "2026-06-01T00:00",
        entry_end: "2026-08-31T23:59",
        eval_start: "2026-09-01T00:00",
        eval_end: "2026-10-15T23:59",
        poll_active: false,
        poll_start: "2026-10-16T00:00",
        poll_end: "2026-11-15T23:59"
      }
    };
    localStorage.setItem("krenova_configs", JSON.stringify(configs));
  }
  return configs;
};
const saveMockConfigs = (configs) => localStorage.setItem("krenova_configs", JSON.stringify(configs));


// ==========================================
// USER PROFILE METHODS
// ==========================================

export async function getUserProfile(uid) {
  if (isMock) {
    const users = getMockUsers();
    return users.find(u => u.uid === uid) || null;
  } else {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }
}

export async function getUserProfileByEmail(email) {
  const searchEmail = email.toLowerCase();
  if (isMock) {
    const users = getMockUsers();
    return users.find(u => u.email.toLowerCase() === searchEmail) || null;
  } else {
    try {
      const q = query(collection(db, "users"), where("email", "==", searchEmail));
      const querySnapshot = await getDocs(q);
      let profile = null;
      querySnapshot.forEach((doc) => {
        profile = doc.data();
      });
      return profile;
    } catch (e) {
      console.error("Error fetching user profile by email:", e);
      return null;
    }
  }
}

export async function saveUserProfile(uid, profileData) {
  const timestamp = new Date().toISOString();
  
  // Enforce email uniqueness constraint
  if (profileData.email) {
    profileData.email = profileData.email.toLowerCase();
    const existingUser = await getUserProfileByEmail(profileData.email);
    if (existingUser && existingUser.uid !== uid) {
      const isTransition = existingUser.uid.startsWith("pre-") && !uid.startsWith("pre-");
      if (!isTransition) {
        throw new Error("Email sudah terdaftar oleh pengguna lain!");
      }
    }
  }

  if (isMock) {
    const users = getMockUsers();
    const idx = users.findIndex(u => u.uid === uid);
    let record;
    if (idx > -1) {
      record = { ...users[idx], ...profileData, updatedAt: timestamp };
      users[idx] = record;
    } else {
      record = { uid, ...profileData, createdAt: timestamp, updatedAt: timestamp };
      users.push(record);
    }
    saveMockUsers(users);
    return record;
  } else {
    const docRef = doc(db, "users", uid);
    const existing = await getDoc(docRef);
    let record = {};
    if (existing.exists()) {
      record = { ...existing.data(), ...profileData, updatedAt: timestamp };
    } else {
      record = { uid, ...profileData, createdAt: timestamp, updatedAt: timestamp };
    }
    await setDoc(docRef, record);
    return record;
  }
}

export async function deleteUserProfile(uid) {
  if (isMock) {
    const users = getMockUsers();
    const filtered = users.filter(u => u.uid !== uid);
    saveMockUsers(filtered);
    return true;
  } else {
    const docRef = doc(db, "users", uid);
    await deleteDoc(docRef);
    return true;
  }
}

export async function listUsersByRole(role) {
  if (isMock) {
    const users = getMockUsers();
    return users.filter(u => u.role === role);
  } else {
    const q = query(collection(db, "users"), where("role", "==", role));
    const querySnapshot = await getDocs(q);
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data());
    });
    return list;
  }
}

export async function listAllUsers() {
  if (isMock) {
    return getMockUsers();
  } else {
    const querySnapshot = await getDocs(collection(db, "users"));
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data());
    });
    return list;
  }
}


// ==========================================
// PROPOSAL METHODS
// ==========================================

export async function saveProposal(proposalData, isDraft = false) {
  const status = isDraft ? "Draft" : "Submitted";
  const timestamp = new Date().toISOString();
  
  if (isMock) {
    const proposals = getMockProposals();
    let proposalId = proposalData.id;
    let existingIndex = -1;
    
    if (proposalId) {
      existingIndex = proposals.findIndex(p => p.id === proposalId);
    } else {
      proposalId = "prop-" + Math.random().toString(36).substr(2, 9);
    }
    
    const record = {
      ...proposalData,
      id: proposalId,
      status: status,
      createdAt: existingIndex > -1 ? proposals[existingIndex].createdAt : timestamp,
      updatedAt: timestamp
    };
    
    if (existingIndex > -1) {
      proposals[existingIndex] = record;
    } else {
      proposals.push(record);
    }
    
    saveMockProposals(proposals);
    return record;
  } else {
    let proposalId = proposalData.id;
    let createdAt = timestamp;
    
    if (!proposalId) {
      const newDocRef = doc(collection(db, "proposals"));
      proposalId = newDocRef.id;
    } else {
      const docRef = doc(db, "proposals", proposalId);
      try {
        const existingDoc = await getDoc(docRef);
        if (existingDoc.exists()) {
          createdAt = existingDoc.data().createdAt || timestamp;
        }
      } catch (e) {
        console.warn("Unable to fetch existing doc, defaulting createdAt to current time:", e);
      }
    }
    
    const docRef = doc(db, "proposals", proposalId);
    const record = {
      ...proposalData,
      id: proposalId,
      status: status,
      createdAt: createdAt,
      updatedAt: timestamp
    };
    
    await setDoc(docRef, record);
    return record;
  }
}

// Admin approves or rejects proposal
export async function updateProposalStatus(id, newStatus) {
  if (isMock) {
    const proposals = getMockProposals();
    const idx = proposals.findIndex(p => p.id === id);
    if (idx > -1) {
      proposals[idx].status = newStatus;
      proposals[idx].updatedAt = new Date().toISOString();
      saveMockProposals(proposals);
      return proposals[idx];
    }
    throw new Error("Proposal tidak ditemukan!");
  } else {
    const docRef = doc(db, "proposals", id);
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      const updated = { ...existing.data(), status: newStatus, updatedAt: new Date().toISOString() };
      await setDoc(docRef, updated);
      return updated;
    }
    throw new Error("Proposal tidak ditemukan!");
  }
}

export async function getUserProposals(userId) {
  if (!userId) return [];
  
  if (isMock) {
    const proposals = getMockProposals();
    return proposals
      .filter(p => p.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } else {
    try {
      const q = query(collection(db, "proposals"), where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push(doc.data());
      });
      return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (error) {
      console.error("Error fetching proposals from Firestore:", error);
      throw error;
    }
  }
}

export async function getAllProposals(role = null) {
  if (isMock) {
    const props = getMockProposals();
    if (role === "juri") {
      return props
        .filter(p => p.status === "Approved")
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    return props.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } else {
    try {
      let q;
      if (role === "juri") {
        q = query(collection(db, "proposals"), where("status", "==", "Approved"));
      } else {
        q = collection(db, "proposals");
      }
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push(doc.data());
      });
      return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (e) {
      console.error("Error fetching all proposals:", e);
      throw e;
    }
  }
}

export async function getProposalById(id) {
  if (!id) return null;
  
  if (isMock) {
    const proposals = getMockProposals();
    return proposals.find(p => p.id === id) || null;
  } else {
    const docRef = doc(db, "proposals", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }
}

export async function deleteProposal(id) {
  if (!id) return false;
  
  if (isMock) {
    const proposals = getMockProposals();
    const index = proposals.findIndex(p => p.id === id);
    if (index > -1) {
      proposals.splice(index, 1);
      saveMockProposals(proposals);
      return true;
    }
    return false;
  } else {
    const docRef = doc(db, "proposals", id);
    await deleteDoc(docRef);
    return true;
  }
}


// ==========================================
// BIDANG LOMBA METHODS
// ==========================================

export async function getBidangLomba() {
  if (isMock) {
    return getMockBidang();
  } else {
    const querySnapshot = await getDocs(collection(db, "bidang"));
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data());
    });
    return list;
  }
}

export async function saveBidangLomba(bidangData) {
  if (isMock) {
    const bidang = getMockBidang();
    let id = bidangData.id;
    let idx = -1;
    if (id) {
      idx = bidang.findIndex(b => b.id === id);
    } else {
      id = "bid-" + Math.random().toString(36).substr(2, 9);
    }
    
    const record = { id, nama: bidangData.nama };
    if (idx > -1) {
      bidang[idx] = record;
    } else {
      bidang.push(record);
    }
    saveMockBidang(bidang);
    return record;
  } else {
    let id = bidangData.id;
    if (!id) {
      const newRef = doc(collection(db, "bidang"));
      id = newRef.id;
    }
    const docRef = doc(db, "bidang", id);
    const record = { id, nama: bidangData.nama };
    await setDoc(docRef, record);
    return record;
  }
}

export async function deleteBidangLomba(id) {
  if (isMock) {
    const bidang = getMockBidang();
    const filtered = bidang.filter(b => b.id !== id);
    saveMockBidang(filtered);
    return true;
  } else {
    const docRef = doc(db, "bidang", id);
    await deleteDoc(docRef);
    return true;
  }
}


// ==========================================
// SCORING (PENILAIAN) METHODS
// ==========================================

export async function saveEvaluation(evalData) {
  const timestamp = new Date().toISOString();
  const id = `${evalData.proposalId}_${evalData.juriId}`;
  
  const record = {
    ...evalData,
    id,
    updatedAt: timestamp
  };
  
  if (isMock) {
    const scores = getMockPenilaian();
    const idx = scores.findIndex(s => s.id === id);
    if (idx > -1) {
      scores[idx] = record;
    } else {
      scores.push(record);
    }
    saveMockPenilaian(scores);
    return record;
  } else {
    const docRef = doc(db, "penilaian", id);
    await setDoc(docRef, record);
    return record;
  }
}

export async function getProposalEvaluations(proposalId) {
  if (isMock) {
    const scores = getMockPenilaian();
    return scores.filter(s => s.proposalId === proposalId);
  } else {
    const q = query(collection(db, "penilaian"), where("proposalId", "==", proposalId));
    const querySnapshot = await getDocs(q);
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data());
    });
    return list;
  }
}

export async function getJuriEvaluations(juriId) {
  if (isMock) {
    const scores = getMockPenilaian();
    return scores.filter(s => s.juriId === juriId);
  } else {
    const q = query(collection(db, "penilaian"), where("juriId", "==", juriId));
    const querySnapshot = await getDocs(q);
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data());
    });
    return list;
  }
}

export async function getAllEvaluations() {
  if (isMock) {
    return getMockPenilaian();
  } else {
    const querySnapshot = await getDocs(collection(db, "penilaian"));
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data());
    });
    return list;
  }
}


// ==========================================
// TIMELINE CONFIG METHODS
// ==========================================

export async function getSystemConfig(key) {
  if (isMock) {
    const configs = getMockConfigs();
    return configs[key] || null;
  } else {
    const docRef = doc(db, "configs", key);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }
}

export async function saveSystemConfig(key, data) {
  if (isMock) {
    const configs = getMockConfigs();
    configs[key] = data;
    saveMockConfigs(configs);
    return data;
  } else {
    const docRef = doc(db, "configs", key);
    await setDoc(docRef, data);
    return data;
  }
}

// ==========================================
// POLLING (VOTING) METHODS
// ==========================================

const getMockVotes = () => JSON.parse(localStorage.getItem("krenova_votes") || "[]");
const saveMockVotes = (votes) => localStorage.setItem("krenova_votes", JSON.stringify(votes));

export async function getPollVotes() {
  if (isMock) {
    return getMockVotes();
  } else {
    try {
      const querySnapshot = await getDocs(collection(db, "votes"));
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push(doc.data());
      });
      return list;
    } catch (e) {
      console.error("Error fetching poll votes:", e);
      throw e;
    }
  }
}

export async function checkHasVoted(email) {
  const checkEmail = email.trim().toLowerCase();
  if (isMock) {
    const votes = getMockVotes();
    return votes.some(v => v.email === checkEmail);
  } else {
    try {
      const docRef = doc(db, "votes", checkEmail);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (e) {
      console.error("Error checking if user voted:", e);
      return false;
    }
  }
}

export async function castVote(email, pelajarProposalId, umumProposalId) {
  const voteEmail = email.trim().toLowerCase();
  
  if (!pelajarProposalId && !umumProposalId) {
    throw new Error("Pilih setidaknya satu proposal untuk melakukan vote!");
  }
  
  const alreadyVoted = await checkHasVoted(voteEmail);
  if (alreadyVoted) {
    throw new Error("Email ini sudah menyalurkan hak suaranya!");
  }

  const timestamp = new Date().toISOString();
  const record = {
    email: voteEmail,
    pelajarProposalId: pelajarProposalId || null,
    umumProposalId: umumProposalId || null,
    votedAt: timestamp
  };

  if (isMock) {
    const votes = getMockVotes();
    votes.push(record);
    saveMockVotes(votes);

    // Update voteCount in localStorage proposals
    const proposals = JSON.parse(localStorage.getItem("krenova_proposals") || "[]");
    if (pelajarProposalId) {
      const pIdx = proposals.findIndex(p => p.id === pelajarProposalId);
      if (pIdx > -1) {
        proposals[pIdx].voteCount = (proposals[pIdx].voteCount || 0) + 1;
      }
    }
    if (umumProposalId) {
      const pIdx = proposals.findIndex(p => p.id === umumProposalId);
      if (pIdx > -1) {
        proposals[pIdx].voteCount = (proposals[pIdx].voteCount || 0) + 1;
      }
    }
    localStorage.setItem("krenova_proposals", JSON.stringify(proposals));
    return record;
  } else {
    const docRef = doc(db, "votes", voteEmail);
    await setDoc(docRef, record);

    if (pelajarProposalId) {
      try {
        const propRef = doc(db, "proposals", pelajarProposalId);
        await updateDoc(propRef, {
          voteCount: increment(1)
        });
      } catch (e) {
        console.error("Failed to increment voteCount on pelajar proposal:", e);
      }
    }
    if (umumProposalId) {
      try {
        const propRef = doc(db, "proposals", umumProposalId);
        await updateDoc(propRef, {
          voteCount: increment(1)
        });
      } catch (e) {
        console.error("Failed to increment voteCount on umum proposal:", e);
      }
    }
    return record;
  }
}

// ==========================================
// AI ANALYSIS METHODS
// ==========================================

const getMockAIAnalyses = () => JSON.parse(localStorage.getItem("krenova_ai_analyses") || "{}");
const saveMockAIAnalyses = (analyses) => localStorage.setItem("krenova_ai_analyses", JSON.stringify(analyses));

export async function getAIAnalysis(proposalId) {
  if (isMock) {
    const analyses = getMockAIAnalyses();
    return analyses[proposalId] || null;
  } else {
    const docRef = doc(db, "ai_analyses", proposalId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }
}

export async function saveAIAnalysis(proposalId, data) {
  if (isMock) {
    const analyses = getMockAIAnalyses();
    analyses[proposalId] = data;
    saveMockAIAnalyses(analyses);
    return data;
  } else {
    const docRef = doc(db, "ai_analyses", proposalId);
    await setDoc(docRef, data);
    return data;
  }
}
