import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy,
  getDoc
} from "firebase/firestore";
import { DiaryEntry, Reminder, UserProfile } from "../types";

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// IMPORTANT: REPLACE THIS CONFIG WITH YOUR OWN FROM THE FIREBASE CONSOLE
// Go to https://console.firebase.google.com/ -> Project Settings -> General -> Your Apps
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export const loginWithGoogle = async (): Promise<UserProfile> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Create User Profile object
    const userProfile: UserProfile = {
      id: user.uid,
      name: user.displayName || "User",
      email: user.email || "",
      avatar: user.photoURL || ""
    };

    // Ensure user document exists in Firestore
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
       ...userProfile,
       lastLogin: Date.now()
    }, { merge: true });

    return userProfile;
  } catch (error) {
    console.error("Login failed", error);
    throw error;
  }
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const subscribeToAuth = (callback: (user: UserProfile | null) => void) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      callback({
        id: user.uid,
        name: user.displayName || "User",
        email: user.email || "",
        avatar: user.photoURL || ""
      });
    } else {
      callback(null);
    }
  });
};

// --- Database Operations ---

export const subscribeToEntries = (userId: string, callback: (entries: DiaryEntry[]) => void) => {
  const q = query(collection(db, "users", userId, "entries"), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => doc.data() as DiaryEntry);
    callback(entries);
  });
};

export const saveDiaryEntryToCloud = async (userId: string, entry: DiaryEntry) => {
  const entryRef = doc(db, "users", userId, "entries", entry.date); // Using date as ID for uniqueness per day
  await setDoc(entryRef, entry, { merge: true });
};

export const subscribeToReminders = (userId: string, callback: (reminders: Reminder[]) => void) => {
  const q = query(collection(db, "users", userId, "reminders"));
  return onSnapshot(q, (snapshot) => {
    const reminders = snapshot.docs.map(doc => doc.data() as Reminder);
    callback(reminders);
  });
};

export const saveReminderToCloud = async (userId: string, reminder: Reminder) => {
  const ref = doc(db, "users", userId, "reminders", reminder.id);
  await setDoc(ref, reminder);
};

export const saveUserSettings = async (userId: string, settings: { wakeWord?: string, stopWord?: string, geminiApiKey?: string }) => {
    const userRef = doc(db, "users", userId);
    await setDoc(userRef, { settings }, { merge: true });
};

export const getUserSettings = async (userId: string): Promise<{ wakeWord: string, stopWord: string, geminiApiKey?: string } | null> => {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().settings) {
        return snap.data().settings;
    }
    return null;
};
