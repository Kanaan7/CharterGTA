const { getFirebaseAdmin } = require("./_firebaseAdmin");
const { json } = require("./_responses");

async function requireAuth(event) {
  let header =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    event.headers?.AUTHORIZATION ||
    "";

  if (!header.startsWith("Bearer ")) {
    return {
      ok: false,
      response: json(401, { error: "Missing or invalid Authorization header." }),
    };
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      ok: true,
      admin,
      decodedToken,
      db: admin.firestore(),
    };
  } catch (error) {
    console.error("Auth verification failed:", error.message);
    return {
      ok: false,
      response: json(401, { error: "Unable to verify your session." }),
    };
  }
}

module.exports = {
  requireAuth,
};
