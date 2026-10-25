// Firebase Web app public configuration; no password or service account credentials.
// Safety gate: allowlisted Firebase Auth UID must be entered separately after creating
// a dedicated TEST account; actual student backup import is disabled.
// Firebase config identifiers are public, but Firestore access requires signed-in
// users and restrictive firestore.rules deployed in the Firebase project.
window.GUIDANCE_FIREBASE = {
  apiKey: 'AIzaSyCIbJIRQP8XiWQ9WT6XXPekL-80XyLMrrM',
  authDomain: 'student-guidance2.firebaseapp.com',
  projectId: 'student-guidance2',
  appId: '1:11471604599:web:3fddf6f8a543fb772d6f72',
  allowedUid: '', // Set after creating the test user in Firebase Authentication (UID only).
  mode: 'demo',
  allowLegacyImport: false
};
