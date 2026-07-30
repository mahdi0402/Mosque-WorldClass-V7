import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import * as adhan from "adhan";

import {
  initDatabase,
  readMosqueState,
  saveMosqueState,
  databaseStatus
} from "./src/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stateFile = path.join(__dirname, "mosque-state.json");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PIN = String(process.env.ADMIN_PIN || "1234");

const defaults = {
  name: "مسجد النور",
  city: "الجديدة - المكر",
  lat: 32.92,
  lng: 35.15,
  jumuah: "13:00",
  jumuahIqamah: "13:15",

  announcement:
    "مرحبًا بكم في مسجد النور • يرجى إغلاق الهواتف عند الدخول إلى المسجد",

  secondaryAnnouncement:
    "الصلاة نور • حافظوا على نظافة وهدوء المسجد",

  theme: "royal",
  calculationMethod: "UmmAlQura",

  iqamahOffsets: {
    Fajr: 20,
    Dhuhr: 15,
    Asr: 15,
    Maghrib: 10,
    Isha: 15
  }
};

function readLocalState() {
  try {
    const savedState = JSON.parse(
      fs.readFileSync(stateFile, "utf8")
    );

    return {
      ...defaults,
      ...savedState
    };
  } catch {
    return {
      ...defaults
    };
  }
}

let mosqueState = readLocalState();

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(
  express.json({
    limit: "100kb"
  })
);

/*
 * Local Cairo font files
 */
app.use(
  "/vendor/cairo",
  express.static(
    path.join(
      __dirname,
      "node_modules",
      "@fontsource",
      "cairo"
    ),
    {
      immutable: true,
      maxAge: "30d"
    }
  )
);

/*
 * Public files.
 *
 * index:false is important because the root route below
 * selects the correct page for mobile or TV.
 */
app.use(
  express.static(
    path.join(__dirname, "public"),
    {
      maxAge: "1h",
      index: false
    }
  )
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: false
  },

  transports: [
    "websocket",
    "polling"
  ]
});

function calculateTimes(lat, lng) {
  const coordinates = new adhan.Coordinates(
    Number(lat),
    Number(lng)
  );

  const params =
    adhan.CalculationMethod.UmmAlQura();

  params.madhab = adhan.Madhab.Shafi;

  const prayers = new adhan.PrayerTimes(
    coordinates,
    new Date(),
    params
  );

  const format = (date) =>
    date.toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jerusalem"
      }
    );

  return {
    Fajr: format(prayers.fajr),
    Sunrise: format(prayers.sunrise),
    Dhuhr: format(prayers.dhuhr),
    Asr: format(prayers.asr),
    Maghrib: format(prayers.maghrib),
    Isha: format(prayers.isha)
  };
}

function fullState() {
  return {
    ...mosqueState,

    timings: calculateTimes(
      mosqueState.lat,
      mosqueState.lng
    ),

    serverTime: new Date().toISOString()
  };
}

function secureEqual(left, right) {
  const firstValue = Buffer.from(
    String(left)
  );

  const secondValue = Buffer.from(
    String(right)
  );

  return (
    firstValue.length === secondValue.length &&
    crypto.timingSafeEqual(
      firstValue,
      secondValue
    )
  );
}

function requireAdmin(req, res, next) {
  const pin =
    req.get("x-admin-pin") || "";

  if (!secureEqual(pin, ADMIN_PIN)) {
    return res.status(401).json({
      success: false,
      error: "ADMIN_AUTH_REQUIRED"
    });
  }

  next();
}

const adminLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    error: "TOO_MANY_REQUESTS"
  }
});

/*
 * Health check for Render
 */
app.get(
  "/api/health",
  async (_req, res) => {
    const db = await databaseStatus();

    res
      .status(db.ok ? 200 : 503)
      .json({
        ok: db.ok,
        version: "7.1.0",
        database: db.mode,
        quran: "offline",
        uptime: Math.round(
          process.uptime()
        )
      });
  }
);

/*
 * Current mosque state
 */
app.get(
  "/api/state",
  (_req, res) => {
    res.set(
      "Cache-Control",
      "no-store"
    );

    res.json(fullState());
  }
);

/*
 * Verify admin PIN
 */
app.post(
  "/api/admin/verify",
  adminLimiter,
  requireAdmin,
  (_req, res) => {
    res.json({
      success: true
    });
  }
);

/*
 * Update mosque settings
 */
app.post(
  "/api/admin/update",
  adminLimiter,
  requireAdmin,
  async (req, res, next) => {
    try {
      const allowedFields = [
        "name",
        "city",
        "lat",
        "lng",
        "jumuah",
        "jumuahIqamah",
        "announcement",
        "secondaryAnnouncement",
        "theme",
        "iqamahOffsets"
      ];

      const update =
        Object.fromEntries(
          Object.entries(
            req.body || {}
          ).filter(([key]) =>
            allowedFields.includes(key)
          )
        );

      const lat = Number(
        update.lat ??
        mosqueState.lat
      );

      const lng = Number(
        update.lng ??
        mosqueState.lng
      );

      const invalidLatitude =
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90;

      const invalidLongitude =
        !Number.isFinite(lng) ||
        lng < -180 ||
        lng > 180;

      if (
        invalidLatitude ||
        invalidLongitude
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "INVALID_COORDINATES"
          });
      }

      update.lat = lat;
      update.lng = lng;

      mosqueState = {
        ...mosqueState,
        ...update
      };

      await saveMosqueState(
        mosqueState,
        {
          ip: req.ip,

          userAgent:
            req.get("user-agent") ||
            ""
        }
      );

      const state = fullState();

      io.emit(
        "stateUpdate",
        state
      );

      res.json({
        success: true,
        state
      });
    } catch (error) {
      next(error);
    }
  }
);

/*
 * Socket.IO real-time connection
 */
io.on(
  "connection",
  (socket) => {
    socket.emit(
      "stateUpdate",
      fullState()
    );
  }
);

/*
 * Check if request comes from a phone or tablet.
 *
 * Manual options:
 * ?display=mobile
 * ?display=tv
 */
function isMobileRequest(req) {
  if (
    req.query.display ===
    "mobile"
  ) {
    return true;
  }

  if (
    req.query.display === "tv"
  ) {
    return false;
  }

  const userAgent =
    req.get("user-agent") || "";

  const mobilePattern =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

  return mobilePattern.test(
    userAgent
  );
}

/*
 * Smart main URL:
 *
 * Phone -> mobile-app.html
 * Computer/TV -> tv-display.html
 */
app.get(
  "/",
  (req, res) => {
    const page =
      isMobileRequest(req)
        ? "mobile-app.html"
        : "tv-display.html";

    res.set(
      "Vary",
      "User-Agent"
    );

    res.set(
      "Cache-Control",
      "no-store"
    );

    res.sendFile(
      path.join(
        __dirname,
        "public",
        page
      )
    );
  }
);

/*
 * Internal server error handler
 */
app.use(
  (error, _req, res, _next) => {
    console.error(
      "Request failed:",
      error.message
    );

    res.status(500).json({
      success: false,
      error:
        "INTERNAL_SERVER_ERROR"
    });
  }
);

server.on(
  "error",
  (error) => {
    if (
      error.code ===
      "EADDRINUSE"
    ) {
      console.error(
        `\nPort ${PORT} is already in use.\n`
      );

      console.error(
        `Run: netstat -ano | findstr :${PORT}\n`
      );

      process.exit(1);
    }

    throw error;
  }
);

async function start() {
  await initDatabase(
    defaults
  );

  mosqueState = {
    ...defaults,
    ...(await readMosqueState())
  };

  server.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `\n🕌 Mosque WorldClass V7.1: http://localhost:${PORT}`
      );

      console.log(
        `🗄️ Storage: ${
          process.env.DATABASE_URL
            ? "PostgreSQL"
            : "local JSON"
        }\n`
      );
    }
  );
}

async function shutdown(signal) {
  console.log(
    `${signal}: shutting down`
  );

  io.close();

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

start().catch((error) => {
  console.error(
    "Startup failed:",
    error
  );

  process.exit(1);
});