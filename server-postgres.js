require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const path = require("path");
const crypto = require("crypto");
const QRCode = require("qrcode");
const pool = require("./database/postgres");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    store: new pgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(express.static(path.join(__dirname, "public")));

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in to continue."
        });
    }
    next();
}

function validId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function page(file) {
    return path.join(__dirname, "public", file);
}

// PUBLIC PAGES
app.get("/", (req, res) => res.sendFile(page("index.html")));
app.get("/register", (req, res) => res.sendFile(page("register.html")));
app.get("/login", (req, res) => {
    if (req.session.user) return res.redirect("/dashboard");
    res.sendFile(page("login.html"));
});

app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/register");
    res.sendFile(page("dashboard.html"));
});

app.get("/create-wedding", (req, res) => {
    if (!req.session.user) return res.redirect("/register");
    res.sendFile(page("create-wedding.html"));
});

app.get("/invitation-designer", (req, res) => {
    if (!req.session.user) return res.redirect("/register");
    res.sendFile(page("invitation-designer.html"));
});

app.get("/guest-management", (req, res) => {
    if (!req.session.user) return res.redirect("/register");
    res.sendFile(page("guest-management.html"));
});

app.get("/scanner", (req, res) => {
    if (!req.session.user) return res.redirect("/register");
    res.sendFile(page("scanner.html"));
});

app.get("/check-in/:token", (req, res) => {
    if (!req.session.user) return res.redirect("/register");
    res.sendFile(page("scanner.html"));
});

app.get("/attendance", (req, res) => {
    if (!req.session.user) return res.redirect("/register");
    res.sendFile(page("attendance.html"));
});

// ACCOUNT REGISTRATION
app.post("/api/register", async (req, res) => {
    try {
        const { fullName, email, password, confirmPassword } = req.body;

        const cleanName = typeof fullName === "string" ? fullName.trim() : "";
        const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Please enter a name between 2 and 100 characters."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match."
            });
        }

        const existing = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [cleanEmail]
        );

        if (existing.rowCount > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (full_name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, full_name, email`,
            [cleanName, cleanEmail, passwordHash]
        );

        const user = result.rows[0];

        req.session.user = {
            id: user.id,
            fullName: user.full_name,
            email: user.email
        };

        req.session.save(error => {
            if (error) {
                console.error("Session save error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Account created, but session could not be started. Please log in again."
                });
            }

            res.status(201).json({
                success: true,
                message: "Your WeddingPass account has been created!",
                redirect: "/dashboard"
            });
        });

    } catch (error) {
        console.error("Registration error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to create your account right now."
        });
    }
});

// ACCOUNT LOGIN
app.post("/api/login", async (req, res) => {
    try {
        const email = typeof req.body.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";

        const password = typeof req.body.password === "string"
            ? req.body.password
            : "";

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter your email and password."
            });
        }

        const result = await pool.query(
            `SELECT id, full_name, email, password_hash
             FROM users
             WHERE email = $1`,
            [email]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: "Incorrect email or password."
            });
        }

        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Incorrect email or password."
            });
        }

        req.session.user = {
            id: user.id,
            fullName: user.full_name,
            email: user.email
        };

        req.session.save(error => {
            if (error) {
                console.error("Login session error:", error.message);
                return res.status(500).json({
                    success: false,
                    message: "Unable to start your session. Please try again."
                });
            }

            res.json({
                success: true,
                message: "Welcome back to WeddingPass!",
                redirect: "/dashboard"
            });
        });

    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to log in right now. Please try again."
        });
    }
});
// CURRENT ACCOUNT
app.get("/api/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false });
    }

    res.json({
        success: true,
        user: req.session.user
    });
});



// LOGOUT ACCOUNT
app.post("/api/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error.message);
            return res.status(500).json({
                success: false,
                message: "Unable to log out."
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            success: true,
            message: "Logged out successfully."
        });
    });
});
// CREATE WEDDING
app.post("/api/weddings", requireLogin, async (req, res) => {
    try {
        const { weddingName, weddingDate, venue, template } = req.body;
        const cleanName = typeof weddingName === "string" ? weddingName.trim() : "";
        const cleanDate = typeof weddingDate === "string" && weddingDate.trim()
            ? weddingDate.trim()
            : null;
        const cleanVenue = typeof venue === "string" ? venue.trim() : "";

        if (cleanDate) {
            const parsedDate = new Date(`${cleanDate}T00:00:00Z`);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) ||
                Number.isNaN(parsedDate.getTime()) ||
                parsedDate.toISOString().slice(0, 10) !== cleanDate) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid wedding date."
                });
            }
        }

        if (cleanVenue.length > 250) {
            return res.status(400).json({
                success: false,
                message: "Venue must not exceed 250 characters."
            });
        }

        const allowedTemplates = [
            "Luxury Gold & White",
            "Royal Black & Gold",
            "Elegant White & Wine Red",
            "Modern Colourful",
            "Custom"
        ];

        if (cleanName.length < 2 || cleanName.length > 150) {
            return res.status(400).json({
                success: false,
                message: "Wedding name must be between 2 and 150 characters."
            });
        }

        const selectedTemplate = allowedTemplates.includes(template)
            ? template
            : "Luxury Gold & White";

        const baseSlug = cleanName.toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60) || "wedding";

        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            const result = await client.query(
                `INSERT INTO weddings
                 (owner_id, wedding_name, wedding_date, venue, template)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [
                    req.session.user.id,
                    cleanName,
                    cleanDate,
                    cleanVenue || null,
                    selectedTemplate
                ]
            );

            const weddingId = result.rows[0].id;
            const publicSlug = `${baseSlug}-${weddingId}`;

            await client.query(
                "UPDATE weddings SET public_slug = $1 WHERE id = $2",
                [publicSlug, weddingId]
            );

            await client.query("COMMIT");

            res.status(201).json({
                success: true,
                message: "Wedding created successfully!",
                weddingId,
                publicSlug,
                invitationLink: "/i/" + publicSlug
            });
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Create wedding error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to create wedding."
        });
    }
});

// LIST ORGANIZER WEDDINGS
app.get("/api/weddings", requireLogin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, wedding_name, wedding_date, venue, template,
                    created_at, bride_name, groom_name, public_slug
             FROM weddings
             WHERE owner_id = $1
             ORDER BY id DESC`,
            [req.session.user.id]
        );

        res.json({
            success: true,
            weddings: result.rows
        });
    } catch (error) {
        console.error("List weddings error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load weddings."
        });
    }
});

// GET INVITATION DETAILS
app.get("/api/weddings/:weddingId/invitation", requireLogin, async (req, res) => {
    try {
        const weddingId = validId(req.params.weddingId);

        if (!weddingId) {
            return res.status(400).json({
                success: false,
                message: "Invalid wedding ID."
            });
        }

        const result = await pool.query(
            `SELECT id, wedding_name, wedding_date, venue, template,
                    bride_name, groom_name, invitation_message, public_slug
             FROM weddings
             WHERE id = $1 AND owner_id = $2`,
            [weddingId, req.session.user.id]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Wedding not found."
            });
        }

        res.json({
            success: true,
            wedding: result.rows[0]
        });
    } catch (error) {
        console.error("Get invitation error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load invitation."
        });
    }
});

// SAVE INVITATION DESIGN
app.put("/api/weddings/:weddingId/invitation", requireLogin, async (req, res) => {
    try {
        const weddingId = validId(req.params.weddingId);

        if (!weddingId) {
            return res.status(400).json({
                success: false,
                message: "Invalid wedding ID."
            });
        }

        const {
            brideName,
            groomName,
            weddingDate,
            venue,
            invitationMessage,
            template
        } = req.body;

        const fields = [
            ["Bride name", brideName, 100],
            ["Groom name", groomName, 100],
            ["Venue", venue, 250],
            ["Invitation message", invitationMessage, 2000]
        ];

        for (const [label, value, max] of fields) {
            if (value !== undefined &&
                (typeof value !== "string" || value.length > max)) {
                return res.status(400).json({
                    success: false,
                    message: `${label} is invalid or too long.`
                });
            }
        }

        if (weddingDate !== undefined &&
            weddingDate !== "" &&
            (typeof weddingDate !== "string" ||
             !/^\d{4}-\d{2}-\d{2}$/.test(weddingDate))) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid wedding date."
            });
        }

        const allowedTemplates = [
            "Luxury Gold & White",
            "Royal Black & Gold",
            "Elegant White & Wine Red",
            "Modern Colourful",
            "Custom"
        ];

        if (template !== undefined && !allowedTemplates.includes(template)) {
            return res.status(400).json({
                success: false,
                message: "Invalid invitation template."
            });
        }

        const result = await pool.query(
            `UPDATE weddings
             SET bride_name = COALESCE($1, bride_name),
                 groom_name = COALESCE($2, groom_name),
                 wedding_date = COALESCE($3, wedding_date),
                 venue = COALESCE($4, venue),
                 invitation_message = COALESCE($5, invitation_message),
                 template = COALESCE($6, template)
             WHERE id = $7 AND owner_id = $8
             RETURNING id`,
            [
                brideName === undefined ? null : brideName.trim(),
                groomName === undefined ? null : groomName.trim(),
                weddingDate === undefined ? null : weddingDate,
                venue === undefined ? null : venue.trim(),
                invitationMessage === undefined ? null : invitationMessage.trim(),
                template === undefined ? null : template,
                weddingId,
                req.session.user.id
            ]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Wedding not found."
            });
        }

        res.json({
            success: true,
            message: "Invitation saved successfully!"
        });
    } catch (error) {
        console.error("Save invitation error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to save invitation."
        });
    }
});


// ADD GUEST
app.post("/api/weddings/:weddingId/guests", requireLogin, async (req, res) => {
    try {
        const weddingId = validId(req.params.weddingId);

        if (!weddingId) {
            return res.status(400).json({
                success: false,
                message: "Invalid wedding ID."
            });
        }

        const { guestName, phone, email, category } = req.body;
        const cleanName = typeof guestName === "string" ? guestName.trim() : "";

        if (cleanName.length < 2 || cleanName.length > 150) {
            return res.status(400).json({
                success: false,
                message: "Guest name must be between 2 and 150 characters."
            });
        }

        const cleanPhone = typeof phone === "string" ? phone.trim() : "";
        const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
        const allowedCategories = ["VIP", "Family", "Friends", "General"];
        const cleanCategory = allowedCategories.includes(category) ? category : "General";

        if (cleanPhone.length > 30 || cleanEmail.length > 254) {
            return res.status(400).json({
                success: false,
                message: "Phone number or email is too long."
            });
        }

        if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid guest email."
            });
        }

        const wedding = await pool.query(
            "SELECT id FROM weddings WHERE id = $1 AND owner_id = $2",
            [weddingId, req.session.user.id]
        );

        if (!wedding.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Wedding not found."
            });
        }

        const qrToken = crypto.randomBytes(24).toString("hex");

        const result = await pool.query(
            `INSERT INTO guests
             (wedding_id, guest_name, phone, email, category, qr_token, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
             RETURNING id`,
            [
                weddingId,
                cleanName,
                cleanPhone || null,
                cleanEmail || null,
                cleanCategory,
                qrToken
            ]
        );

        res.status(201).json({
            success: true,
            message: "Guest added successfully!",
            guestId: result.rows[0].id
        });

    } catch (error) {
        console.error("Add guest error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to add guest."
        });
    }
});

// LIST GUESTS
app.get("/api/weddings/:weddingId/guests", requireLogin, async (req, res) => {
    try {
        const weddingId = validId(req.params.weddingId);

        if (!weddingId) {
            return res.status(400).json({
                success: false,
                message: "Invalid wedding ID."
            });
        }

        const wedding = await pool.query(
            "SELECT id FROM weddings WHERE id = $1 AND owner_id = $2",
            [weddingId, req.session.user.id]
        );

        if (!wedding.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Wedding not found."
            });
        }

        const result = await pool.query(
            `SELECT id, guest_name, phone, email, category,
                    qr_token, status, checked_in_at, created_at
             FROM guests
             WHERE wedding_id = $1
             ORDER BY id DESC`,
            [weddingId]
        );

        res.json({
            success: true,
            guests: result.rows
        });

    } catch (error) {
        console.error("List guests error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load guests."
        });
    }
});

// GENERATE PRIVATE GUEST QR CODE
app.get(
    "/api/weddings/:weddingId/guests/:guestId/qr",
    requireLogin,
    async (req, res) => {
        try {
            const weddingId = validId(req.params.weddingId);
            const guestId = validId(req.params.guestId);

            if (!weddingId || !guestId) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid wedding or guest ID."
                });
            }

            const result = await pool.query(
                `SELECT g.qr_token
                 FROM guests g
                 INNER JOIN weddings w ON w.id = g.wedding_id
                 WHERE g.id = $1
                   AND w.id = $2
                   AND w.owner_id = $3`,
                [guestId, weddingId, req.session.user.id]
            );

            if (!result.rowCount) {
                return res.status(404).json({
                    success: false,
                    message: "Guest not found."
                });
            }

            const checkInUrl =
                `${req.protocol}://${req.get("host")}/check-in/${result.rows[0].qr_token}`;

            const qrImage = await QRCode.toBuffer(checkInUrl, {
                type: "png",
                width: 350,
                margin: 2,
                errorCorrectionLevel: "H"
            });

            res.setHeader("Content-Type", "image/png");
            res.setHeader("Cache-Control", "no-store");
            res.send(qrImage);

        } catch (error) {
            console.error("Guest QR error:", error.message);
            res.status(500).json({
                success: false,
                message: "Unable to generate guest QR code."
            });
        }
    }
);

// CHECK IN GUEST
app.post("/api/check-in", requireLogin, async (req, res) => {
    try {
        const token = typeof req.body.token === "string"
            ? req.body.token.trim()
            : "";

        if (!/^[a-f0-9]{48}$/i.test(token)) {
            return res.status(400).json({
                success: false,
                status: "INVALID",
                message: "Invalid QR code."
            });
        }

        const result = await pool.query(
            `UPDATE guests g
             SET status = 'Checked In',
                 checked_in_at = CURRENT_TIMESTAMP
             FROM weddings w
             WHERE g.wedding_id = w.id
               AND w.owner_id = $2
               AND g.qr_token = $1
               AND LOWER(g.status) <> 'checked in'
             RETURNING g.id, g.guest_name, g.category,
                       g.status, g.checked_in_at, w.wedding_name`,
            [token, req.session.user.id]
        );

        if (!result.rowCount) {
            const existing = await pool.query(
                `SELECT g.id, g.guest_name, g.category,
                        g.status, g.checked_in_at, w.wedding_name
                 FROM guests g
                 INNER JOIN weddings w ON w.id = g.wedding_id
                 WHERE g.qr_token = $1
                   AND w.owner_id = $2`,
                [token, req.session.user.id]
            );

            if (!existing.rowCount) {
                return res.status(404).json({
                    success: false,
                    status: "INVALID",
                    message: "Guest not found or you do not have access."
                });
            }

            const guest = existing.rows[0];

            return res.status(409).json({
                success: false,
                status: "ALREADY USED",
                message: "This guest has already checked in.",
                guest: {
                    name: guest.guest_name,
                    category: guest.category,
                    wedding: guest.wedding_name,
                    checkedInAt: guest.checked_in_at
                }
            });
        }

        const guest = result.rows[0];

        return res.json({
            success: true,
            status: "VALID",
            message: "Guest checked in successfully!",
            guest: {
                name: guest.guest_name,
                category: guest.category,
                wedding: guest.wedding_name,
                checkedInAt: guest.checked_in_at
            }
        });

    } catch (error) {
        console.error("Check-in error:", error.message);
        return res.status(500).json({
            success: false,
            status: "INVALID",
            message: "Unable to check in guest."
        });
    }
});


// ATTENDANCE PAGE DATA
app.get("/api/weddings/:weddingId/attendance", requireLogin, async (req, res) => {
    try {
        const weddingId = validId(req.params.weddingId);

        if (!weddingId) {
            return res.status(400).json({
                success: false,
                message: "Invalid wedding ID."
            });
        }

        const wedding = await pool.query(
            `SELECT id, wedding_name
             FROM weddings
             WHERE id = $1 AND owner_id = $2`,
            [weddingId, req.session.user.id]
        );

        if (!wedding.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Wedding not found."
            });
        }

        const summaryResult = await pool.query(
            `SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (
                    WHERE LOWER(status) = 'checked in'
                )::int AS "checkedIn",
                COUNT(*) FILTER (
                    WHERE LOWER(status) <> 'checked in'
                )::int AS pending
             FROM guests
             WHERE wedding_id = $1`,
            [weddingId]
        );

        const categoriesResult = await pool.query(
            `SELECT category,
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (
                        WHERE LOWER(status) = 'checked in'
                    )::int AS checked_in
             FROM guests
             WHERE wedding_id = $1
             GROUP BY category
             ORDER BY category`,
            [weddingId]
        );

        const guestsResult = await pool.query(
            `SELECT id, guest_name, phone, email, category,
                    status, checked_in_at, created_at
             FROM guests
             WHERE wedding_id = $1
             ORDER BY
                CASE WHEN LOWER(status) = 'checked in' THEN 0 ELSE 1 END,
                checked_in_at DESC NULLS LAST,
                guest_name ASC`,
            [weddingId]
        );

        const summary = summaryResult.rows[0];
        const attendanceRate = summary.total > 0
            ? Number(((summary.checkedIn / summary.total) * 100).toFixed(1))
            : 0;

        res.json({
            success: true,
            wedding: wedding.rows[0],
            summary: {
                ...summary,
                attendanceRate
            },
            categories: categoriesResult.rows,
            guests: guestsResult.rows
        });

    } catch (error) {
        console.error("Attendance error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load attendance report."
        });
    }
});

// PUBLIC INVITATION PAGE
app.get("/i/:slug", (req, res) => {
    res.sendFile(page("public-invitation.html"));
});

// PUBLIC INVITATION DETAILS
app.get("/api/public/invitations/:slug", async (req, res) => {
    try {
        const slug = String(req.params.slug || "").trim();

        const result = await pool.query(
            `SELECT wedding_name, wedding_date, venue, template,
                    bride_name, groom_name, invitation_message, public_slug
             FROM weddings
             WHERE public_slug = $1`,
            [slug]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found."
            });
        }

        res.json({
            success: true,
            wedding: result.rows[0]
        });

    } catch (error) {
        console.error("Public invitation error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to load invitation."
        });
    }
});

// PUBLIC INVITATION QR CODE
app.get("/api/public/invitations/:slug/qr", async (req, res) => {
    try {
        const slug = String(req.params.slug || "").trim();

        const result = await pool.query(
            `SELECT public_slug
             FROM weddings
             WHERE public_slug = $1`,
            [slug]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Invitation not found."
            });
        }

        const invitationUrl =
            `${req.protocol}://${req.get("host")}/i/${result.rows[0].public_slug}`;

        const qrImage = await QRCode.toBuffer(invitationUrl, {
            type: "png",
            width: 350,
            margin: 2,
            errorCorrectionLevel: "H"
        });

        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.send(qrImage);

    } catch (error) {
        console.error("Public invitation QR error:", error.message);
        res.status(500).json({
            success: false,
            message: "Unable to generate invitation QR code."
        });
    }
});

// HEALTH CHECK
app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({
            success: true,
            application: "WeddingPass",
            database: "PostgreSQL",
            status: "Connected"
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            application: "WeddingPass",
            status: "Database unavailable"
        });
    }
});

// START SERVER
app.use((error, req, res, next) => {
    console.error("Unexpected server error:", error.message);

    if (res.headersSent) return next(error);

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("====================================");
    console.log("       WEDDINGPASS SERVER");
    console.log("====================================");
    console.log("Database: Neon PostgreSQL");
    console.log(`Port: ${PORT}`);
    console.log("Status: RUNNING");
});






