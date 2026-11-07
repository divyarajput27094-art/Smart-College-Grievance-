
const complaintRoutes = require("./complaints");
const ideaRoutes = require("./ideas");
const db = require("./db");
const authRoutes = require("./auth");


const app = express();

app.set("trust proxy", 1);

app.use(express.static(__dirname));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ADMIN AUTHENTICATION MIDDLEWARE
async function requireAdmin(req, res, next) {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const [users] = await db.query(
            `SELECT user_id FROM users
             WHERE user_id = ? AND role = 'admin'
             AND is_active = TRUE`,
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });
        }

        next();

    } catch (error) {
        console.error("Admin authentication error:", error.message);

        res.status(500).json({
            success: false,
            message: "Authentication failed"
        });
    }
}

// Home API
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to Smart College Grievance System"
    });
});

// Database connection check
app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");

        res.json({
            success: true,
            message: "Backend and MySQL connected successfully!"
        });

    } catch (error) {
        console.error("Health check error:", error.message);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

// Departments API
app.get("/api/departments", async (req, res) => {
    try {
        const [departments] = await db.query(
            "SELECT department_id, department_name FROM departments ORDER BY department_name"
        );

        res.json({
            success: true,
            data: departments
        });

    } catch (error) {
        console.error("Departments error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch departments"
        });
    }
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Complaint routes
app.use("/api/complaints", complaintRoutes);

// Ideas routes
app.use("/api/ideas", ideaRoutes);

// Admin Dashboard API
app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
    try {
        const [complaints] = await db.query(`
            SELECT
                COUNT(*) AS total,
                SUM(status = 'Submitted') AS pending,
                SUM(status = 'Under Review') AS underReview,
                SUM(status = 'Resolved') AS resolved
            FROM complaints
        `);

        const [ideas] = await db.query(`
            SELECT COUNT(*) AS total FROM student_ideas
        `);

        res.json({
            success: true,
            data: {
                totalComplaints: complaints[0].total,
                pendingComplaints: complaints[0].pending || 0,
                underReviewComplaints: complaints[0].underReview || 0,
                resolvedComplaints: complaints[0].resolved || 0,
                totalIdeas: ideas[0].total
            }
        });

    } catch (error) {
        console.error("Admin dashboard error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to load dashboard"
        });
    }
});

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        const connection = await db.getConnection();

        console.log("MySQL Connected Successfully!");

        connection.release();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
}

startServer();
