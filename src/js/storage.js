import { storage, isMock } from "./firebase-config.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

/**
 * Uploads a file with progress tracking
 * @param {File} file - The file object to upload
 * @param {string} path - Firebase Storage destination path (e.g. proposals/userId/file.pdf)
 * @param {function} progressCallback - Callback receiving percent completion (0-100)
 * @returns {Promise<string>} - Resolves with the download URL of the uploaded file
 */
export async function uploadFile(file, path, progressCallback) {
  if (!file) return "";
  
  if (isMock) {
    return new Promise((resolve) => {
      let percent = 0;
      const interval = setInterval(() => {
        percent += 20;
        if (progressCallback) progressCallback(percent);
        
        if (percent >= 100) {
          clearInterval(interval);
          // Create local object URL for preview purposes in the active tab session
          try {
            const objectUrl = URL.createObjectURL(file);
            console.log(`Mock uploaded file to ${path}. Temp URL: ${objectUrl}`);
            resolve(objectUrl);
          } catch (e) {
            resolve("https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&auto=format&fit=crop"); // fallback photo
          }
        }
      }, 100);
    });
  } else {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (progressCallback) progressCallback(Math.round(progress));
        }, 
        (error) => {
          console.error("Firebase Storage Upload Error:", error);
          reject(error);
        }, 
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }
}
