
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");

const router = express.Router();

// STUDENT REGISTRATION
router.post("/register", async (req, res) => {
    try {
        const {
            full_name,
            enrollment_number,
            email,
            password,
            department_id
        } = req.body;

        if (!full_name || !enrollment_number || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO users
            (full_name, enrollment_number, email, password_hash, department_id, role)
            VALUES (?, ?, ?, ?, ?, 'student')`,
            [
                full_name.trim(),
                enrollment_number.trim(),
                email.trim().toLowerCase(),
                hashedPassword,
                department_id || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Student registered successfully!"
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Enrollment number or email already registered"
            });
        }

        console.error("Registration error:", error.message);

        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});

// COMMON LOGIN FUNCTION
async function loginUser(req, res, requiredRole) {
    try {
        const { enrollment_number, password } = req.body;

        if (!enrollment_number || !password) {
            return res.status(400).json({
                success: false,
                message: "Login ID and password are required"
            });
        }

        const [users] = await db.query(
            `SELECT user_id, full_name, enrollment_number,
                    email, password_hash, role, department_id, is_active
             FROM users
             WHERE enrollment_number = ? AND role = ?`,
            [enrollment_number.trim(), requiredRole]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid Login ID or password"
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive"
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid Login ID or password"
            });
        }

        req.session.userId = user.user_id;
        req.session.userRole = user.role;

        res.json({
            success: true,
            message: "Login successful!",
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                enrollment_number: user.enrollment_number,
                email: user.email,
                role: user.role,
                department_id: user.department_id
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
}

// STUDENT LOGIN
router.post("/login", (req, res) => {
    loginUser(req, res, "student");
});

// ADMIN LOGIN
router.post("/admin-login", (req, res) => {
    loginUser(req, res, "admin");
});

// GET LOGGED-IN USER
router.get("/me", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first"
            });
        }

        const [users] = await db.query(
            `SELECT user_id, full_name, enrollment_number,
                    email, role, department_id
             FROM users
             WHERE user_id = ? AND is_active = TRUE`,
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User account not found or inactive"
            });
        }

        res.json({
            success: true,
            user: users[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to fetch user"
        });
    }
});

// LOGOUT
router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                success: false,
                message: "Logout failed"
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            success: true,
            message: "Logged out successfully"
        });
    });
});

module.exports = router;
