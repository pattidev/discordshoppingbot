/**
 * Google Authentication Utility
 */

// A simple in-memory cache for the Google Auth Token to avoid regenerating it on every request.
// Cloudflare may spin down idle workers, so this cache is not guaranteed to persist for long.
let googleAuthToken = null;
let tokenExpiry = 0;

/**
 * Creates a JWT token for Google API authentication.
 * @param {object} payload - The JWT payload.
 * @param {string} privateKeyPem - The private key in PEM format.
 * @returns {Promise<string>} The JWT token.
 */
async function createJWT(payload, privateKeyPem) {
	// Create header
	const header = {
		alg: "RS256",
		typ: "JWT",
	};

	// Base64URL encode
	const base64UrlEncode = (obj) => {
		return btoa(JSON.stringify(obj))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");
	};

	const encodedHeader = base64UrlEncode(header);
	const encodedPayload = base64UrlEncode(payload);
	const message = `${encodedHeader}.${encodedPayload}`;

	// Import private key
	const pemHeader = "-----BEGIN PRIVATE KEY-----";
	const pemFooter = "-----END PRIVATE KEY-----";
	const pemContents = privateKeyPem
		.replace(pemHeader, "")
		.replace(pemFooter, "")
		.replace(/\s/g, "");

	const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

	const cryptoKey = await crypto.subtle.importKey(
		"pkcs8",
		binaryDer,
		{
			name: "RSASSA-PKCS1-v1_5",
			hash: "SHA-256",
		},
		false,
		["sign"]
	);

	// Sign
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		cryptoKey,
		new TextEncoder().encode(message)
	);

	// Encode signature
	const encodedSignature = btoa(
		String.fromCharCode(...new Uint8Array(signature))
	)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");

	return `${message}.${encodedSignature}`;
}

/**
 * Gets a Google API auth token, using a cached one if available and not expired.
 * @param {object} env - The Cloudflare Worker environment variables.
 * @returns {Promise<string>} The Google API access token.
 */
export async function getGoogleAuthToken(env) {
	if (googleAuthToken && Date.now() < tokenExpiry) {
		return googleAuthToken;
	}

	try {
		const credentials = JSON.parse(env.GDRIVE_API_CREDENTIALS);
		const scope =
			"https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";
		const aud = "https://oauth2.googleapis.com/token";

		const now = Math.floor(Date.now() / 1000);

		const payload = {
			iss: credentials.client_email,
			scope: scope,
			aud: aud,
			iat: now,
			exp: now + 3600,
		};

		const jwt = await createJWT(payload, credentials.private_key);

		const response = await fetch(aud, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		const tokenData = await response.json();
		if (!tokenData.access_token) {
			console.error("Failed to get Google auth token:", tokenData);
			throw new Error(
				"Could not authenticate with Google: " +
					(tokenData.error_description || tokenData.error || "Unknown error")
			);
		}

		googleAuthToken = tokenData.access_token;
		tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;

		return googleAuthToken;
	} catch (error) {
		console.error("Error getting Google auth token:", error);
		throw new Error("Google authentication failed: " + error.message);
	}
}
