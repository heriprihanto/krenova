import { auth, isMock } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  TwitterAuthProvider,
  FacebookAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getUserProfile,
  getUserProfileByEmail,
  saveUserProfile,
  deleteUserProfile,
  getMockUsers,
  saveMockUsers
} from "./db.js";

// Mock Active User helper
const getActiveMockUser = () => JSON.parse(localStorage.getItem("krenova_current_user") || "null");
const setActiveMockUser = (user) => {
  if (user) {
    localStorage.setItem("krenova_current_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("krenova_current_user");
  }
};

const mockListeners = [];

// Sign Up User
export async function signUpUser(email, password, fullName = "") {
  if (isMock) {
    const users = getMockUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("Email sudah terdaftar!");
    }
    const role = email.toLowerCase() === "galileo21@gmail.com" ? "admin" : "peserta";
    const newUser = {
      uid: "mock-" + Math.random().toString(36).substr(2, 9),
      email: email,
      fullName: fullName,
      role: role,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    saveMockUsers(users);
    setActiveMockUser(newUser);
    triggerMockAuthStateChange(newUser);
    return newUser;
  } else {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    try {
      // Check if email was pre-registered by Admin (e.g. as Juri or Admin)
      let profile = await getUserProfileByEmail(email);
      const role = email.toLowerCase() === "galileo21@gmail.com" ? "admin" : (profile ? profile.role : "peserta");
      const userProfile = await saveUserProfile(userCredential.user.uid, {
        email,
        fullName: fullName || (profile ? profile.fullName : email.split('@')[0]),
        role
      });
      // Delete temporary pre-registered profile if different
      if (profile && profile.uid !== userCredential.user.uid) {
        await deleteUserProfile(profile.uid).catch(err => console.warn("Temporary profile deletion failed:", err));
      }
      userCredential.user.role = userProfile.role;
      userCredential.user.fullName = userProfile.fullName;
    } catch (dbError) {
      console.error("Database registration steps failed:", dbError);
      // Fallback role assignment so user is not stuck on loading screen
      userCredential.user.role = email.toLowerCase() === "galileo21@gmail.com" ? "admin" : "peserta";
      userCredential.user.fullName = fullName || email.split('@')[0];
    }
    return userCredential.user;
  }
}

// Sign In User
export async function signInUser(email, password) {
  if (isMock) {
    const users = getMockUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error("Email tidak terdaftar!");
    }
    setActiveMockUser(user);
    triggerMockAuthStateChange(user);
    return user;
  } else {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    try {
      let profile = await getUserProfile(userCredential.user.uid);
      if (!profile) {
        // Look up by email
        profile = await getUserProfileByEmail(email);
        if (profile) {
          profile = await saveUserProfile(userCredential.user.uid, {
            email,
            fullName: profile.fullName,
            role: email.toLowerCase() === "galileo21@gmail.com" ? "admin" : profile.role
          });
          if (profile.uid !== userCredential.user.uid) {
            await deleteUserProfile(profile.uid).catch(err => console.warn("Temporary profile deletion failed:", err));
          }
        } else {
          profile = await saveUserProfile(userCredential.user.uid, {
            email,
            fullName: email.split('@')[0],
            role: email.toLowerCase() === "galileo21@gmail.com" ? "admin" : "peserta"
          });
        }
      } else if (email.toLowerCase() === "galileo21@gmail.com" && profile.role !== "admin") {
        profile = await saveUserProfile(userCredential.user.uid, {
          ...profile,
          role: "admin"
        });
      }
      userCredential.user.role = profile.role;
      userCredential.user.fullName = profile.fullName;
    } catch (dbError) {
      console.error("Database fetch during login failed:", dbError);
      userCredential.user.role = email.toLowerCase() === "galileo21@gmail.com" ? "admin" : "peserta";
      userCredential.user.fullName = email.split('@')[0];
    }
    return userCredential.user;
  }
}

// Helper to process database state after OAuth login success
async function handleOAuthResult(result) {
  if (result.user) {
    const userEmail = result.user.email || `${result.user.uid}@krenova-oauth.com`;
    try {
      let profile = await getUserProfile(result.user.uid);
      if (!profile) {
        profile = await getUserProfileByEmail(userEmail);
        if (profile) {
          profile = await saveUserProfile(result.user.uid, {
            email: userEmail,
            fullName: result.user.displayName || profile.fullName || userEmail.split('@')[0],
            role: userEmail.toLowerCase() === "galileo21@gmail.com" ? "admin" : profile.role
          });
          if (profile.uid !== result.user.uid) {
            await deleteUserProfile(profile.uid).catch(err => console.warn("Temporary profile deletion failed:", err));
          }
        } else {
          profile = await saveUserProfile(result.user.uid, {
            email: userEmail,
            fullName: result.user.displayName || userEmail.split('@')[0],
            role: userEmail.toLowerCase() === "galileo21@gmail.com" ? "admin" : "peserta"
          });
        }
      } else if (userEmail.toLowerCase() === "galileo21@gmail.com" && profile.role !== "admin") {
        profile = await saveUserProfile(result.user.uid, {
          ...profile,
          role: "admin"
        });
      }
      result.user.role = profile.role;
      result.user.fullName = profile.fullName;
    } catch (dbError) {
      console.error("Database setup during OAuth Login failed:", dbError);
      result.user.role = userEmail.toLowerCase() === "galileo21@gmail.com" ? "admin" : "peserta";
      result.user.fullName = result.user.displayName || userEmail.split('@')[0];
    }
  }
  return result.user;
}

// Helper for Mock OAuth Chooser Prompt
async function mockOAuthSignIn(providerName) {
  const input = prompt(`Pilih Akun Mock untuk Masuk (${providerName}):\n1. Admin (admin@krenova.com)\n2. Juri (juri@krenova.com)\n3. Peserta (peserta@krenova.com)\n4. Admin Galileo (galileo21@gmail.com)\nAtau masukkan alamat email baru Anda untuk mendaftar sebagai peserta:`, "4");
  
  if (!input) throw new Error(`${providerName} sign-in dibatalkan.`);
  
  let targetEmail = "";
  if (input === "1") targetEmail = "admin@krenova.com";
  else if (input === "2") targetEmail = "juri@krenova.com";
  else if (input === "3") targetEmail = "peserta@krenova.com";
  else if (input === "4") targetEmail = "galileo21@gmail.com";
  else targetEmail = input.trim();
  
  if (!targetEmail.includes("@")) {
    throw new Error("Format email tidak valid.");
  }
  
  const users = getMockUsers();
  let user = users.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());
  if (!user) {
    const role = targetEmail.toLowerCase() === "galileo21@gmail.com" ? "admin" : "peserta";
    user = {
      uid: "mock-" + Math.random().toString(36).substr(2, 9),
      email: targetEmail,
      fullName: targetEmail.split('@')[0],
      role: role,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveMockUsers(users);
  }
  
  setActiveMockUser(user);
  triggerMockAuthStateChange(user);
  return user;
}

// Sign In with Google Account
export async function signInWithGoogle() {
  if (isMock) {
    return mockOAuthSignIn("Google");
  } else {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return handleOAuthResult(result);
  }
}

// Sign In with X (Twitter) Account
export async function signInWithX() {
  if (isMock) {
    return mockOAuthSignIn("X");
  } else {
    const provider = new TwitterAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return handleOAuthResult(result);
  }
}

// Sign In with Facebook Account
export async function signInWithFacebook() {
  if (isMock) {
    return mockOAuthSignIn("Facebook");
  } else {
    const provider = new FacebookAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return handleOAuthResult(result);
  }
}

// Sign Out User
export async function signOutUser() {
  if (isMock) {
    setActiveMockUser(null);
    triggerMockAuthStateChange(null);
    return true;
  } else {
    await signOut(auth);
    return true;
  }
}

// Listen to Auth state changes
export function onAuthStateChangedListener(callback) {
  if (isMock) {
    mockListeners.push(callback);
    const currentUser = getActiveMockUser();
    setTimeout(() => callback(currentUser), 50);
    return () => {
      const idx = mockListeners.indexOf(callback);
      if (idx > -1) mockListeners.splice(idx, 1);
    };
  } else {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          let profile = await getUserProfile(user.uid);
          if (!profile) {
            profile = await getUserProfileByEmail(user.email);
            if (profile) {
              profile = await saveUserProfile(user.uid, {
                email: user.email,
                fullName: profile.fullName,
                role: user.email.toLowerCase() === "galileo21@gmail.com" ? "admin" : profile.role
              });
              if (profile.uid !== user.uid) {
                await deleteUserProfile(profile.uid).catch(err => console.warn("Temporary profile deletion failed:", err));
              }
            } else {
              profile = await saveUserProfile(user.uid, {
                email: user.email,
                fullName: user.displayName || user.email.split('@')[0],
                role: user.email.toLowerCase() === "galileo21@gmail.com" ? "admin" : "peserta"
              });
            }
          } else if (user.email.toLowerCase() === "galileo21@gmail.com" && profile.role !== "admin") {
            profile = await saveUserProfile(user.uid, {
              ...profile,
              role: "admin"
            });
          }
          user.role = profile.role || "peserta";
          user.fullName = profile.fullName || user.displayName || user.email.split('@')[0];
        } catch (dbError) {
          console.error("Database operations in auth listener failed:", dbError);
          user.role = user.email.toLowerCase() === "galileo21@gmail.com" ? "admin" : "peserta";
          user.fullName = user.displayName || user.email.split('@')[0];
        }
      }
      callback(user);
    });
  }
}

// Get Current User synchronously
export function getCurrentUser() {
  if (isMock) {
    return getActiveMockUser();
  } else {
    const user = auth.currentUser;
    return user;
  }
}

// Helper to notify listeners of mock auth events
function triggerMockAuthStateChange(user) {
  mockListeners.forEach(listener => {
    try {
      listener(user);
    } catch (e) {
      console.error("Error in mock auth listener:", e);
    }
  });
}
