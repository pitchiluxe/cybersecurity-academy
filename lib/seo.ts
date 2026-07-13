// Shared SEO constants and structured data. SITE_URL drives canonical URLs,
// Open Graph, sitemap, and robots; set NEXT_PUBLIC_SITE_URL in production.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://techbench-academy.vercel.app").replace(/\/$/, "");
export const SITE_NAME = "Cybersecurity Academy";
export const SITE_TAGLINE = "Your training lab for real IT support";
export const SITE_DESCRIPTION =
  "Cybersecurity Academy is an AI-powered IT support training lab: work a live ticket queue with remote diagnostics, take 16 certification courses with an AI tutor, wire equipment in interactive 3D labs, and earn certificates — all graded on a real support rubric.";

export const SITE_KEYWORDS = [
  "IT support training",
  "help desk simulator",
  "IT technician practice",
  "CompTIA A+ practice",
  "Network+ course",
  "Security+ training",
  "CCNA lab",
  "FortiGate lab",
  "network wiring simulator",
  "cybersecurity training",
  "IT certification courses",
  "AI tutor",
];

// schema.org structured data (JSON-LD) describing the app and organisation.
export function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icon.png`,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "AI-generated IT support tickets with live end-user chat",
          "Remote diagnostics command simulation",
          "16 cybersecurity certification courses with an AI tutor",
          "Interactive 3D network wiring and FortiGate labs",
          "Simulated virtual machine labs",
          "Rubric-based grading and printable certificates",
        ],
      },
    ],
  };
}
