// Firebase TEST connection: no credentials are configured or uploaded here.
// Register a Web app in Firebase console (Spark plan), create ONE test user,
// deploy reviewed firestore.rules, then enter the PUBLIC config values below.
// Firebase apiKey is a public project identifier, NOT a service-account secret.
// Do not deploy real school/student data until the competent authority approves.
// NEVER put service account credentials, passwords, JSON backups or student names in GitHub.
window.GUIDANCE_FIREBASE = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
  allowedUid: '', // Firebase Authentication -> Users -> UID of wife's test account
  mode: 'demo',    // stays demo: real legacy import is always DISABLED
  allowLegacyImport: false
};
